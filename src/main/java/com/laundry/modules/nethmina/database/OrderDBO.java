package com.laundry.modules.nethmina.database;

import com.laundry.config.DBConnection;
import com.laundry.modules.nethmina.model.LaundryOrder;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

@org.springframework.stereotype.Repository
public class OrderDBO {

    public Long insertOrder(LaundryOrder o) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) { return insertOrder(conn, o); }
    }
    private Long insertOrder(Connection conn, LaundryOrder o) throws SQLException {
        try (PreparedStatement stmt = conn.prepareStatement("INSERT INTO orders (customer_id, expected_completion_date, delivery_preference, status, special_instructions) VALUES (?, DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'DELIVERY', ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
            stmt.setLong(1, o.getCustomerId()); stmt.setString(2, mapStatus(o.getStatus())); stmt.setString(3, o.getServiceType());
            stmt.executeUpdate();
            try (ResultSet keys = stmt.getGeneratedKeys()) {
                if (keys.next()) return keys.getLong(1);
            }
        }
        throw new SQLException("Order insert did not return an id");
    }
    public Long book(LaundryOrder o, com.laundry.modules.dasanayaka.model.Garment g, com.laundry.modules.naveeth.model.DeliverySchedule d) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                Long id = insertOrder(conn, o);
                g.setOrderId(id); d.setOrderId(id);
                new com.laundry.modules.dasanayaka.database.GarmentDBO().insertGarment(conn, g);
                new com.laundry.modules.naveeth.database.DeliveryDBO().insertDelivery(conn, d);
                conn.commit();
                return id;
            } catch (SQLException | RuntimeException ex) { conn.rollback(); throw ex; }
        }
    }

    public LaundryOrder getOrderById(Long id) throws SQLException {
        String sql = """
                SELECT order_id AS id, customer_id, special_instructions AS service_type,
                       status, (status <> 'CANCELLED') AS is_active
                  FROM orders WHERE order_id = ?
                """;
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public List<LaundryOrder> getAllOrders() throws SQLException {
        return getAllActiveOrders();
    }

    public List<LaundryOrder> getAllActiveOrders() throws SQLException {
        String sql = """
                SELECT order_id AS id, customer_id, special_instructions AS service_type,
                       status, (status <> 'CANCELLED') AS is_active
                  FROM orders
                 WHERE status <> 'CANCELLED'
                 ORDER BY order_id DESC
                """;
        List<LaundryOrder> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) results.add(mapRow(rs));
        }
        return results;
    }

    public List<LaundryOrder> getOrdersByCustomerId(Long customerId) throws SQLException {
        String sql = """
                SELECT order_id AS id, customer_id, special_instructions AS service_type,
                       status, (status <> 'CANCELLED') AS is_active
                  FROM orders WHERE customer_id = ?
                 ORDER BY order_id DESC
                """;
        List<LaundryOrder> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, customerId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) results.add(mapRow(rs));
            }
        }
        return results;
    }

    public boolean updateOrder(Long id, LaundryOrder o) throws SQLException {
        String sql = "UPDATE orders SET customer_id = ?, special_instructions = ?, status = ? WHERE order_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, o.getCustomerId());
            stmt.setString(2, o.getServiceType());
            stmt.setString(3, mapStatus(o.getStatus()));
            stmt.setLong(4, id);
            return stmt.executeUpdate() > 0;
        }
    }

    public boolean updateStatus(Long id, String status) throws SQLException {
        String sql = "UPDATE orders SET status = ? WHERE order_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, mapStatus(status));
            stmt.setLong(2, id);
            return stmt.executeUpdate() > 0;
        }
    }

    public boolean cancelOrder(Long id) throws SQLException {
        return archiveOrder(id);
    }

    public boolean archiveOrder(Long id) throws SQLException {
        try (Connection conn = DBConnection.getConnection();
             CallableStatement stmt = conn.prepareCall("{CALL sp_cancel_order(?,?)}")) {
            stmt.setLong(1, id);
            stmt.setString(2, "Archived from staff portal");
            stmt.execute();
            return true;
        }
    }

    public boolean isPaid(Long id) throws SQLException {
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("SELECT COUNT(*) FROM invoice WHERE order_id=? AND status='PAID'")) {
            s.setLong(1,id); try(ResultSet r=s.executeQuery()) { r.next(); return r.getInt(1)>0; }
        }
    }

    private LaundryOrder mapRow(ResultSet rs) throws SQLException {
        LaundryOrder o = new LaundryOrder();
        o.setId(rs.getLong("id"));
        o.setCustomerId(rs.getLong("customer_id"));
        o.setServiceType(rs.getString("service_type"));
        o.setStatus(rs.getString("status"));
        o.setActive(rs.getBoolean("is_active"));
        return o;
    }

    private static String mapStatus(String status) {
        if (status == null || status.isBlank() || "Pending".equalsIgnoreCase(status)) {
            return "RECEIVED";
        }
        String s = status.trim().replace(' ', '_').toUpperCase();
        return switch (s) {
            case "PENDING" -> "RECEIVED";
            case "PROCESSING", "WASH", "WASHING" -> "IN_WASHING";
            case "DRY", "DRY_CLEANING" -> "IN_DRY_CLEANING";
            case "IRON", "IRONING" -> "IN_IRONING";
            case "READY" -> "READY_FOR_COLLECTION";
            case "OUT" -> "OUT_FOR_DELIVERY";
            case "DONE", "COMPLETE", "COMPLETED", "DELIVERED" -> "COMPLETED";
            case "CANCEL", "CANCELED" -> "CANCELLED";
            default -> s;
        };
    }
}
