package com.laundry.modules.sathusrika.database;

import com.laundry.config.DBConnection;
import com.laundry.modules.sathusrika.model.Invoice;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

@org.springframework.stereotype.Repository
public class InvoiceDBO {

    private static final String SELECT_COLS = """
            SELECT invoice_id AS id, order_id, amount, status
              FROM invoice
            """;

    public Long insertInvoice(Invoice i) throws SQLException {
        try (Connection c = DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                lockOrder(c,i.getOrderId());
                try (CallableStatement s = c.prepareCall("{CALL sp_generate_invoice(?,?)}")) {
                    s.setLong(1,i.getOrderId()); s.registerOutParameter(2,Types.BIGINT); s.execute();
                    Long id=s.getLong(2); c.commit(); return id;
                }
            } catch (SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }
    private void lockOrder(Connection c, Long id) throws SQLException {
        try (PreparedStatement s=c.prepareStatement("SELECT order_id FROM orders WHERE order_id=? FOR UPDATE")) {
            s.setLong(1,id); try(ResultSet r=s.executeQuery()) { if (!r.next()) throw new IllegalArgumentException("Order not found"); }
        }
    }

    public Invoice getInvoiceById(Long id) throws SQLException {
        String sql = SELECT_COLS + " WHERE invoice_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public List<Invoice> getAllInvoices() throws SQLException {
        Long customerId = DBConnection.isCustomer() ? DBConnection.currentCustomerId() : null;
        String sql = SELECT_COLS + (DBConnection.isCustomer() ? " WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id=?)" : "") + " ORDER BY invoice_id DESC";
        List<Invoice> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            if (customerId != null) stmt.setLong(1,customerId);
            try(ResultSet rs=stmt.executeQuery()) { while(rs.next()) results.add(mapRow(rs)); }
        }
        return results;
    }

    public List<Invoice> getInvoicesByOrderId(Long orderId) throws SQLException {
        String sql = SELECT_COLS + " WHERE order_id = ? ORDER BY invoice_id DESC";
        List<Invoice> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) results.add(mapRow(rs));
            }
        }
        return results;
    }

    public boolean updateInvoice(Long id, Invoice i) throws SQLException {
        Invoice existing=getInvoiceById(id);
        if(existing==null) return false;
        if (!existing.getOrderId().equals(i.getOrderId()) || i.getAmount()==null || !Double.isFinite(i.getAmount())
                || java.math.BigDecimal.valueOf(existing.getAmount()).compareTo(java.math.BigDecimal.valueOf(i.getAmount()))!=0)
            throw new IllegalArgumentException("Invoice order and amount are fixed. Void an unpaid invoice and regenerate from garment charges.");
        if (existing.getStatus().equalsIgnoreCase(i.getStatus())) return true;
        return updateInvoiceStatus(id,i.getStatus());
    }
    public boolean updateInvoiceStatus(Long id, String status) throws SQLException {
        if(status==null) throw new IllegalArgumentException("Payment action is required");
        return switch(status.toUpperCase(java.util.Locale.ROOT)) {
            case "PAID" -> recordSuccessfulPayment(id);
            case "REFUND", "REFUNDED" -> requestRefund(id);
            case "VOID" -> deleteOrVoidInvoice(id);
            default -> throw new IllegalArgumentException("Use record cash payment, request refund or void an unpaid invoice");
        };
    }
    private java.math.BigDecimal lockInvoice(Connection c, Long id) throws SQLException {
        try(PreparedStatement s=c.prepareStatement("SELECT amount,status FROM invoice WHERE invoice_id=? FOR UPDATE")) {
            s.setLong(1,id); try(ResultSet r=s.executeQuery()) {
                if(!r.next()) throw new IllegalArgumentException("Invoice not found");
                if("VOID".equals(r.getString(2))) throw new IllegalArgumentException("A void invoice cannot accept payments or refunds");
                return r.getBigDecimal(1);
            }
        }
    }
    private java.math.BigDecimal successfulTotal(Connection c,Long id) throws SQLException {
        try(PreparedStatement s=c.prepareStatement("SELECT COALESCE(SUM(amount),0) FROM payment WHERE invoice_id=? AND status='SUCCESS'")) {
            s.setLong(1,id); try(ResultSet r=s.executeQuery()) { r.next(); return r.getBigDecimal(1); }
        }
    }
    public boolean deleteOrVoidInvoice(Long id) throws SQLException {
        try(Connection c=DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                lockInvoice(c,id);
                if(successfulTotal(c,id).signum()>0) throw new IllegalArgumentException("Paid money needs an authorised refund; this invoice cannot be voided directly");
                try(PreparedStatement s=c.prepareStatement("UPDATE invoice SET status='VOID' WHERE invoice_id=?")) { s.setLong(1,id); s.executeUpdate(); }
                c.commit(); return true;
            } catch(SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }
    private boolean recordSuccessfulPayment(Long id) throws SQLException {
        if(DBConnection.isCustomer()) throw new org.springframework.security.access.AccessDeniedException("Cash payments must be recorded by the cashier after receipt");
        try(Connection c=DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                DBConnection.staffActor(c);
                var amount=lockInvoice(c,id); var paid=successfulTotal(c,id); var remaining=amount.subtract(paid);
                if(remaining.signum()<=0) { c.commit(); return true; } // Retry after success is a no-op.
                try(CallableStatement s=c.prepareCall("{CALL sp_record_payment(?,?,?,?,?,?,?)}")) {
                    s.setLong(1,id); s.setBigDecimal(2,remaining); s.setString(3,"CASH"); s.setString(4,"SUCCESS");
                    s.setString(5,"CASH-"+id+"-"+paid.toPlainString());
                    s.registerOutParameter(6,Types.BIGINT); s.registerOutParameter(7,Types.VARCHAR); s.execute();
                }
                // The database trigger calculates the actual invoice status from payment records.
                c.commit(); return true;
            } catch(SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }
    private boolean requestRefund(Long id) throws SQLException {
        try(Connection c=DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                lockInvoice(c,id);
                if(successfulTotal(c,id).signum()==0) throw new IllegalArgumentException("Only received payments can be refunded");
                try(PreparedStatement s=c.prepareStatement("INSERT INTO refund (payment_id,amount,reason) SELECT p.payment_id, p.amount-COALESCE((SELECT SUM(r.amount) FROM refund r WHERE r.payment_id=p.payment_id AND r.status<>'REJECTED'),0), 'Requested from payment module' FROM payment p WHERE p.invoice_id=? AND p.status='SUCCESS' AND p.amount>COALESCE((SELECT SUM(r.amount) FROM refund r WHERE r.payment_id=p.payment_id AND r.status<>'REJECTED'),0)")) {
                    s.setLong(1,id); s.executeUpdate();
                }
                c.commit(); return true; // A request is pending approval, not a completed refund.
            } catch(SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }
    public List<java.util.Map<String,Object>> getRefunds() throws SQLException {
        List<java.util.Map<String,Object>> result=new ArrayList<>();
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("SELECT r.refund_id,p.invoice_id,r.amount,r.reason,r.status FROM refund r JOIN payment p ON p.payment_id=r.payment_id ORDER BY r.refund_id DESC"); ResultSet r=s.executeQuery()) {
            while(r.next()) result.add(java.util.Map.of("id",r.getLong(1),"invoiceId",r.getLong(2),"amount",r.getBigDecimal(3),"reason",r.getString(4),"status",r.getString(5)));
        }
        return result;
    }
    public void decideRefund(Long id,String status) throws SQLException {
        String target=status==null ? "" : status.toUpperCase(java.util.Locale.ROOT);
        if(!java.util.Set.of("APPROVED","REJECTED","PROCESSED").contains(target)) throw new IllegalArgumentException("Choose approve, reject or record completed cash refund");
        try(Connection c=DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                Long actor=DBConnection.staffActor(c); String previous;
                try(PreparedStatement s=c.prepareStatement("SELECT status FROM refund WHERE refund_id=? FOR UPDATE")) {
                    s.setLong(1,id); try(ResultSet r=s.executeQuery()) { if(!r.next()) throw new IllegalArgumentException("Refund not found"); previous=r.getString(1); }
                }
                if (!("REQUESTED".equals(previous) && java.util.Set.of("APPROVED","REJECTED").contains(target)) && !("APPROVED".equals(previous) && "PROCESSED".equals(target)))
                    throw new IllegalArgumentException("Approve a requested refund before recording its completion");
                try(PreparedStatement s=c.prepareStatement("UPDATE refund SET status=?,decided_by=?,decided_at=NOW() WHERE refund_id=?")) {
                    s.setString(1,target); s.setLong(2,actor); s.setLong(3,id); s.executeUpdate();
                }
                c.commit();
            } catch(SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }

    public java.util.Map<String,java.math.BigDecimal> summary() throws SQLException {
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("SELECT (SELECT COALESCE(SUM(amount),0) FROM payment WHERE status IN ('SUCCESS','REFUNDED')) AS received, (SELECT COALESCE(SUM(amount),0) FROM refund WHERE status='PROCESSED') AS refunded"); ResultSet r=s.executeQuery()) {
            r.next(); var received=r.getBigDecimal("received"); var refunded=r.getBigDecimal("refunded");
            return java.util.Map.of("received",received,"refunded",refunded,"net",received.subtract(refunded));
        }
    }

    private Invoice mapRow(ResultSet rs) throws SQLException {
        Invoice i = new Invoice();
        i.setId(rs.getLong("id"));
        i.setOrderId(rs.getLong("order_id"));
        i.setAmount(rs.getDouble("amount"));
        i.setStatus(rs.getString("status"));
        return i;
    }

    private static String mapInvoiceStatus(String status) {
        if (status == null || status.isBlank() || "Pending".equalsIgnoreCase(status)) {
            return "PENDING";
        }
        String s = status.trim().replace(' ', '_').toUpperCase();
        return switch (s) {
            case "PAID", "SUCCESS" -> "PAID";
            case "PARTIALLY_PAID", "PARTIAL" -> "PARTIALLY_PAID";
            case "VOID", "CANCELLED", "CANCELED" -> "VOID";
            case "REFUNDED", "REFUND" -> "VOID";
            default -> s;
        };
    }
}
