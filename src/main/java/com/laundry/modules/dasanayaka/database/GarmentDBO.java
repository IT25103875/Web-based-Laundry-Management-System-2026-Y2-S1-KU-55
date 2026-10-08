package com.laundry.modules.dasanayaka.database;

import com.laundry.config.DBConnection;
import com.laundry.modules.dasanayaka.model.Garment;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

@org.springframework.stereotype.Repository
public class GarmentDBO {

    private static final String SELECT_COLS = """
            SELECT g.garment_id AS id, g.order_id, g.fabric_type, g.care_instructions, g.service_id, g.garment_type, g.quantity, g.unit_price,
                   EXISTS (SELECT 1 FROM garment_exception e
                            WHERE e.garment_id = g.garment_id AND e.exception_type = 'DAMAGED') AS is_damaged,
                   EXISTS (SELECT 1 FROM garment_exception e WHERE e.garment_id=g.garment_id AND e.exception_type='MISSING') AS is_missing
              FROM garment g
            """;

    public Long insertGarment(Garment g) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                Long id = insertGarment(conn, g);
                conn.commit();
                return id;
            } catch (SQLException | RuntimeException ex) {
                conn.rollback();
                throw ex;
            }
        }
    }

    public Long insertGarment(Connection conn, Garment g) throws SQLException {
        // Lock the parent before numbering items or calculating an invoice.
        try (PreparedStatement lock = conn
                .prepareStatement("SELECT order_id FROM orders WHERE order_id = ? FOR UPDATE")) {
            lock.setLong(1, g.getOrderId());
            try (ResultSet rows = lock.executeQuery()) {
                if (!rows.next())
                    throw new IllegalArgumentException("Order not found");
            }
        }
        int serviceId = resolveServiceId(conn, g.getServiceId());
        double price = resolveServicePrice(conn, serviceId);
        try (PreparedStatement stmt = conn.prepareStatement(
                "INSERT INTO garment (order_id, garment_no, service_id, garment_type, fabric_type, quantity, unit_price, care_instructions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')",
                Statement.RETURN_GENERATED_KEYS)) {
            stmt.setLong(1, g.getOrderId());
            stmt.setInt(2, nextGarmentNo(conn, g.getOrderId()));
            stmt.setInt(3, serviceId);
            stmt.setString(4, g.getGarmentType());
            stmt.setString(5, g.getFabricType());
            stmt.setInt(6, g.getQuantity());
            stmt.setDouble(7, price);
            stmt.setString(8, g.getCareInstructions());
            stmt.executeUpdate();
            try (ResultSet keys = stmt.getGeneratedKeys()) {
                if (!keys.next())
                    throw new SQLException("Garment insert did not return an id");
                Long id = keys.getLong(1);
                if (g.isDamaged())
                    flagDamage(conn, id, true);
                return id;
            }
        }
    }

    public List<java.util.Map<String, Object>> getServices() throws SQLException {
        List<java.util.Map<String, Object>> results = new ArrayList<>();
        try (Connection c = DBConnection.getConnection();
                PreparedStatement s = c.prepareStatement(
                        "SELECT service_id, service_name, price FROM laundry_service WHERE availability_status = 'AVAILABLE' ORDER BY service_id");
                ResultSet r = s.executeQuery()) {
            while (r.next())
                results.add(java.util.Map.of("id", r.getLong(1), "name", r.getString(2), "price", r.getBigDecimal(3)));
        }
        return results;
    }

    public Garment getGarmentById(Long id) throws SQLException {
        String sql = SELECT_COLS + " WHERE g.garment_id = ?";
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next())
                    return mapRow(rs);
            }
        }
        return null;
    }

    public List<Garment> getAllGarments() throws SQLException {
        Long customerId = DBConnection.isCustomer() ? DBConnection.currentCustomerId() : null;
        String sql = SELECT_COLS + (DBConnection.isCustomer()
                ? " WHERE g.order_id IN (SELECT order_id FROM orders WHERE customer_id = ?)"
                : "") + " ORDER BY g.garment_id DESC";
        List<Garment> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql)) {
            if (customerId != null)
                stmt.setLong(1, customerId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next())
                    results.add(mapRow(rs));
            }
        }
        return results;
    }

    public List<Garment> getGarmentsByOrderId(Long orderId) throws SQLException {
        String sql = SELECT_COLS + " WHERE g.order_id = ? ORDER BY g.garment_no";
        List<Garment> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next())
                    results.add(mapRow(rs));
            }
        }
        return results;
    }

    public boolean updateGarment(Long id, Garment g) throws SQLException {
        String sql = "UPDATE garment SET fabric_type = ?, care_instructions = ?, garment_type = ?, quantity = ? WHERE garment_id = ?";
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setString(1, g.getFabricType());
                    stmt.setString(2, g.getCareInstructions());
                    stmt.setString(3, g.getGarmentType());
                    stmt.setInt(4, g.getQuantity());
                    stmt.setLong(5, id);
                    if (stmt.executeUpdate() == 0) {
                        conn.rollback();
                        return false;
                    }
                }
                flagDamage(conn, id, g.isDamaged());
                conn.commit();
                return true;
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean flagDamage(Long id, boolean damaged) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            return flagDamage(conn, id, damaged);
        }
    }

    public boolean deleteGarment(Long id) throws SQLException {
        String sql = "DELETE FROM garment WHERE garment_id = ?";
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            return stmt.executeUpdate() > 0;
        }
    }

    private boolean flagDamage(Connection conn, Long garmentId, boolean damaged) throws SQLException {
        if (damaged) {
            String exists = "SELECT exception_id FROM garment_exception WHERE garment_id = ? AND exception_type = 'DAMAGED' LIMIT 1";
            try (PreparedStatement check = conn.prepareStatement(exists)) {
                check.setLong(1, garmentId);
                try (ResultSet rs = check.executeQuery()) {
                    if (rs.next())
                        return true;
                }
            }
            Long staffId = DBConnection.staffActor(conn);
            if (staffId == null) {
                throw new SQLException("Cannot flag damage until at least one staff member exists");
            }
            String insert = """
                    INSERT INTO garment_exception (garment_id, exception_type, description, flagged_by)
                    VALUES (?, 'DAMAGED', 'Flagged from garment module', ?)
                    """;
            try (PreparedStatement stmt = conn.prepareStatement(insert)) {
                stmt.setLong(1, garmentId);
                stmt.setLong(2, staffId);
                stmt.executeUpdate();
            }
            return true;
        }
        // Preserve exception history; unchecking a box must not erase a reported
        // incident.
        return true;
    }

    public void reportException(Long id, String type, String description) throws SQLException {
        try (Connection c = DBConnection.getConnection();
                PreparedStatement s = c.prepareStatement(
                        "INSERT INTO garment_exception (garment_id,exception_type,description,flagged_by) VALUES (?,?,?,?)")) {
            s.setLong(1, id);
            s.setString(2, type);
            s.setString(3, description);
            s.setLong(4, DBConnection.staffActor(c));
            s.executeUpdate();
        }
    }

    private int nextGarmentNo(Connection conn, Long orderId) throws SQLException {
        try (PreparedStatement stmt = conn.prepareStatement(
                "SELECT COALESCE(MAX(garment_no), 0) + 1 FROM garment WHERE order_id = ?")) {
            stmt.setLong(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    private int resolveServiceId(Connection conn, Long id) throws SQLException {
        DBConnection.positiveId(id, "Service");
        try (PreparedStatement s = conn.prepareStatement(
                "SELECT service_id FROM laundry_service WHERE service_id = ? AND availability_status = 'AVAILABLE'")) {
            s.setLong(1, id);
            try (ResultSet r = s.executeQuery()) {
                if (r.next())
                    return r.getInt(1);
            }
        }
        throw new IllegalArgumentException("Choose an available laundry service");
    }

    private double resolveServicePrice(Connection conn, int serviceId) throws SQLException {
        try (PreparedStatement stmt = conn.prepareStatement("SELECT price FROM laundry_service WHERE service_id = ?")) {
            stmt.setInt(1, serviceId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next())
                    return rs.getDouble(1);
            }
        }
        throw new IllegalArgumentException("Laundry service not found");
    }

    private Garment mapRow(ResultSet rs) throws SQLException {
        Garment g = new Garment();
        g.setId(rs.getLong("id"));
        g.setOrderId(rs.getLong("order_id"));
        g.setFabricType(rs.getString("fabric_type"));
        g.setCareInstructions(rs.getString("care_instructions"));
        g.setDamaged(rs.getBoolean("is_damaged"));
        g.setMissing(rs.getBoolean("is_missing"));
        g.setServiceId(rs.getLong("service_id"));
        g.setGarmentType(rs.getString("garment_type"));
        g.setQuantity(rs.getInt("quantity"));
        g.setUnitPrice(rs.getDouble("unit_price"));
        return g;
    }

}
