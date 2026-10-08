package com.laundry.modules.sathusrika.service;

import com.laundry.modules.sathusrika.database.InvoiceDBO;
import com.laundry.modules.sathusrika.model.Invoice;
import com.laundry.config.DBConnection;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;

@Service
public class PaymentService {

    private final InvoiceDBO dbo;

    public PaymentService(InvoiceDBO dbo) { this.dbo = dbo; }

    public Invoice generateInvoice(Invoice i) {
        DBConnection.positiveId(i.getOrderId(), "Order");
        try {
            DBConnection.requireOrder(i.getOrderId());
            Long id = dbo.insertInvoice(i);
            i.setId(id);
            return getInvoice(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not generate invoice", e);
        }
    }

    public List<Invoice> getAllInvoices() {
        try {
            return dbo.getAllInvoices();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load invoices", e);
        }
    }

    public List<Invoice> getInvoicesByOrder(Long orderId) {
        try {
            DBConnection.requireOrder(orderId);
            return dbo.getInvoicesByOrderId(orderId);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load invoices for order", e);
        }
    }

    public Invoice getInvoice(Long id) {
        try {
            Invoice i = dbo.getInvoiceById(id);
            if (i == null) {
                throw new IllegalArgumentException("Invoice not found");
            }
            DBConnection.requireOrder(i.getOrderId());
            return i;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load invoice", e);
        }
    }

    public Invoice updateInvoice(Long id, Invoice u) {
        Invoice i = getInvoice(id);
        try {
            dbo.updateInvoice(id, u);
            return getInvoice(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update invoice", e);
        }
    }

    // Strategy: each finance action chooses its own database operation.
    @FunctionalInterface
    private interface FinanceAction { boolean execute(Long id) throws SQLException; }
    private Invoice execute(Long id, FinanceAction action) {
        getInvoice(id);
        try {
            if (!action.execute(id)) throw new IllegalArgumentException("Invoice not found");
            return getInvoice(id);
        } catch(SQLException ex) { throw new IllegalStateException("Could not complete payment action",ex); }
    }
    public Invoice processPayment(Long id) { return execute(id, value -> dbo.updateInvoiceStatus(value,"Paid")); }
    public Invoice voidOrRefund(Long id,String status) { return execute(id, value -> dbo.updateInvoiceStatus(value,status)); }
    public void deleteInvoice(Long id) { execute(id,dbo::deleteOrVoidInvoice); }
    public java.util.Map<String,java.math.BigDecimal> summary() {
        try { return dbo.summary(); } catch(SQLException ex) { throw new IllegalStateException("Could not load payment totals",ex); }
    }
    public List<java.util.Map<String,Object>> refunds() {
        try { return dbo.getRefunds(); } catch(SQLException ex) { throw new IllegalStateException("Could not load refunds",ex); }
    }
    public void decideRefund(Long id,String status) {
        DBConnection.positiveId(id,"Refund");
        try { dbo.decideRefund(id,status); } catch(SQLException ex) { throw new IllegalStateException("Could not update refund",ex); }
    }
}
