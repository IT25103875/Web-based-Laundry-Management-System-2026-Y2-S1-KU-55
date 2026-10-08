package com.laundry.modules.naveeth.database;

import com.laundry.config.DBConnection;
import com.laundry.modules.naveeth.model.DeliverySchedule;

import java.sql.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@org.springframework.stereotype.Repository
public class DeliveryDBO {

    private static final String SELECT_COLS = """
            SELECT d.delivery_id AS id,
                   d.order_id, d.delivery_type,
                   COALESCE(u.full_name, CONCAT('Staff #', d.assigned_staff_id), 'Unassigned') AS driver_name,
                   CONCAT(d.scheduled_date, ' ', d.scheduled_time) AS time_slot,
                   d.status
              FROM delivery d
              LEFT JOIN users u ON u.user_id = d.assigned_staff_id
            """;

    public Long insertDelivery(DeliverySchedule d) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) { return insertDelivery(conn, d); }
    }
    public Long insertDelivery(Connection conn, DeliverySchedule d) throws SQLException {
            Long staffId = resolveDriverId(conn, d.getDriverName());
            String address = resolveAddress(conn, d.getOrderId());
            requireDriverShift(conn, staffId, d.getTimeSlot());
            LocalDate date = parseDate(d.getTimeSlot());
            LocalTime time = parseTime(d.getTimeSlot());
            String sql = """
                    INSERT INTO delivery (order_id, delivery_type, address, scheduled_date, scheduled_time,
                                          assigned_staff_id, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """;
            try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                stmt.setLong(1, d.getOrderId());
                stmt.setString(2, d.getDeliveryType()); stmt.setString(3, address);
                stmt.setString(4, date.toString()); stmt.setString(5, time.toString());
                if (staffId == null) {
                    stmt.setNull(6, Types.BIGINT);
                } else {
                    stmt.setLong(6, staffId);
                }
                stmt.setString(7, mapStatus(d.getStatus()));
                stmt.executeUpdate();
                try (ResultSet keys = stmt.getGeneratedKeys()) {
                    if (keys.next()) return keys.getLong(1);
                }
            }
        throw new SQLException("Delivery insert did not return an id");
    }

    public DeliverySchedule getDeliveryById(Long id) throws SQLException {
        String sql = SELECT_COLS + " WHERE d.delivery_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public List<DeliverySchedule> getAllSchedules() throws SQLException {
        Long customerId = DBConnection.isCustomer() ? DBConnection.currentCustomerId() : null;
        String sql = SELECT_COLS + (DBConnection.isCustomer() ? " WHERE d.order_id IN (SELECT order_id FROM orders WHERE customer_id = ?)" : "") + " ORDER BY d.scheduled_date DESC, d.scheduled_time DESC";
        List<DeliverySchedule> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            if (customerId != null) stmt.setLong(1, customerId);
            try (ResultSet rs = stmt.executeQuery()) { while (rs.next()) results.add(mapRow(rs)); }
        }
        return results;
    }

    public List<DeliverySchedule> getSchedulesByOrderId(Long orderId) throws SQLException {
        String sql = SELECT_COLS + " WHERE d.order_id = ? ORDER BY d.delivery_id DESC";
        List<DeliverySchedule> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) results.add(mapRow(rs));
            }
        }
        return results;
    }

    public boolean updateDelivery(Long id, DeliverySchedule d) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                Long staffId = resolveDriverId(conn,d.getDriverName());
                requireDriverShift(conn,staffId,d.getTimeSlot());
                checkDispatch(conn,id,d.getStatus(),staffId);
                try (PreparedStatement s=conn.prepareStatement("UPDATE delivery SET assigned_staff_id=?,scheduled_date=?,scheduled_time=?,status=? WHERE delivery_id=?")) {
                    if(staffId==null) s.setNull(1,Types.BIGINT); else s.setLong(1,staffId);
                    s.setString(2,parseDate(d.getTimeSlot()).toString()); s.setString(3,parseTime(d.getTimeSlot()).toString());
                    s.setString(4,mapStatus(d.getStatus())); s.setLong(5,id);
                    if(s.executeUpdate()==0) throw new IllegalArgumentException("Delivery not found");
                }
                syncOrder(conn,id,d.getStatus()); conn.commit(); return true;
            } catch(SQLException | RuntimeException ex) { conn.rollback(); throw ex; }
        }
    }
    public boolean updateStatus(Long id,String status) throws SQLException {
        DeliverySchedule d=getDeliveryById(id);
        if(d==null) return false;
        d.setStatus(status);
        return updateDelivery(id,d);
    }
    private void checkDispatch(Connection c,Long id,String status,Long driver) throws SQLException {
        String target=mapStatus(status);
        if(!java.util.Set.of("PICKED_UP","IN_TRANSIT","DELIVERED").contains(target)) return;
        if(driver==null) throw new IllegalArgumentException("Assign an available driver before dispatching a delivery");
        boolean dropOff;
        try(PreparedStatement s=c.prepareStatement("SELECT d.delivery_type,o.status,d.status FROM delivery d JOIN orders o ON o.order_id=d.order_id WHERE d.delivery_id=? FOR UPDATE")) {
            s.setLong(1,id); try(ResultSet r=s.executeQuery()) {
                if(!r.next()) throw new IllegalArgumentException("Delivery not found");
                dropOff = "DROP_OFF".equals(r.getString(1));
                if(target.equals(r.getString(3))) return; // Metadata edits keep the existing operational stage.
                if("DROP_OFF".equals(r.getString(1)) && !java.util.Set.of("READY_FOR_COLLECTION","OUT_FOR_DELIVERY").contains(r.getString(2)))
                    throw new IllegalArgumentException("Complete processing and quality checks before dispatching a drop-off");
            }
        }
        if(dropOff && "DELIVERED".equals(target)) {
            try(PreparedStatement s=c.prepareStatement("SELECT COUNT(*) FROM invoice i JOIN delivery d ON d.order_id=i.order_id WHERE d.delivery_id=? AND i.status='PAID'")) {
                s.setLong(1,id); try(ResultSet r=s.executeQuery()) { r.next(); if(r.getInt(1)==0) throw new IllegalArgumentException("Record the received payment before completing a drop-off"); }
            }
        }
    }
    private void syncOrder(Connection c,Long id,String status) throws SQLException {
        String target=mapStatus(status);
        if(!java.util.Set.of("PICKED_UP","IN_TRANSIT","DELIVERED").contains(target)) return;
        String stage="DELIVERED".equals(target)?"COMPLETED":"OUT_FOR_DELIVERY";
        try(PreparedStatement s=c.prepareStatement("UPDATE orders o JOIN delivery d ON d.order_id=o.order_id SET o.status=? WHERE d.delivery_id=? AND d.delivery_type='DROP_OFF' AND o.status IN ('READY_FOR_COLLECTION','OUT_FOR_DELIVERY')")) {
            s.setString(1,stage); s.setLong(2,id); s.executeUpdate();
        }
    }

    public boolean cancelSchedule(Long id) throws SQLException {
        try(Connection c=DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                boolean changed;
                try(PreparedStatement s=c.prepareStatement("UPDATE delivery SET status='CANCELLED' WHERE delivery_id=?")) { s.setLong(1,id); changed=s.executeUpdate()>0; }
                try(PreparedStatement s=c.prepareStatement("UPDATE orders o JOIN delivery d ON d.order_id=o.order_id SET o.status='READY_FOR_COLLECTION' WHERE d.delivery_id=? AND d.delivery_type='DROP_OFF' AND o.status='OUT_FOR_DELIVERY'")) { s.setLong(1,id); s.executeUpdate(); }
                c.commit(); return changed;
            } catch(SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }

    public java.util.Map<String,Object> detail(Long id) throws SQLException {
        List<java.util.Map<String,Object>> history=new ArrayList<>(), incidents=new ArrayList<>();
        try(Connection c=DBConnection.getConnection()) {
            try(PreparedStatement s=c.prepareStatement("SELECT status,changed_at FROM delivery_status_history WHERE delivery_id=? ORDER BY history_id DESC")) {
                s.setLong(1,id); try(ResultSet r=s.executeQuery()) { while(r.next()) history.add(java.util.Map.of("status",r.getString(1),"time",r.getString(2))); }
            }
            try(PreparedStatement s=c.prepareStatement("SELECT incident_id,description,status,reported_at FROM delivery_incident WHERE delivery_id=? ORDER BY incident_id DESC")) {
                s.setLong(1,id); try(ResultSet r=s.executeQuery()) { while(r.next()) incidents.add(java.util.Map.of("id",r.getLong(1),"description",r.getString(2),"status",r.getString(3),"time",r.getString(4))); }
            }
        }
        return java.util.Map.of("history",history,"incidents",incidents);
    }
    public void reportIncident(Long id,String description) throws SQLException {
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("INSERT INTO delivery_incident (delivery_id,description,reported_by) VALUES (?,?,?)")) {
            s.setLong(1,id); s.setString(2,description); s.setLong(3,DBConnection.staffActor(c)); s.executeUpdate();
        }
    }
    public void resolveIncident(Long deliveryId,Long incidentId) throws SQLException {
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("UPDATE delivery_incident SET status='RESOLVED' WHERE incident_id=? AND delivery_id=?")) {
            s.setLong(1,incidentId); s.setLong(2,deliveryId); if(s.executeUpdate()==0) throw new IllegalArgumentException("Incident not found for this delivery");
        }
    }

    private DeliverySchedule mapRow(ResultSet rs) throws SQLException {
        DeliverySchedule d = new DeliverySchedule();
        d.setId(rs.getLong("id"));
        d.setOrderId(rs.getLong("order_id"));
        d.setDriverName(rs.getString("driver_name"));
        d.setTimeSlot(rs.getString("time_slot"));
        d.setStatus(rs.getString("status")); d.setDeliveryType(rs.getString("delivery_type"));
        return d;
    }

    private Long resolveDriverId(Connection conn, String name) throws SQLException {
        if (name == null || name.isBlank() || "Unassigned".equalsIgnoreCase(name.trim())) return null;
        try (PreparedStatement s = conn.prepareStatement("SELECT s.user_id FROM staff s JOIN users u ON u.user_id = s.user_id JOIN staff_role sr ON sr.staff_id = s.user_id AND sr.status = 'ACTIVE' JOIN role r ON r.role_id = sr.role_id WHERE s.work_status = 'ACTIVE' AND u.status = 'ACTIVE' AND r.role_name = 'DRIVER' AND (u.full_name = ? OR u.email = ? OR s.employee_no = ?)")) {
            s.setString(1, name.trim()); s.setString(2, name.trim()); s.setString(3, name.trim());
            try (ResultSet rows = s.executeQuery()) { if (rows.next()) return rows.getLong(1); }
        }
        throw new IllegalArgumentException("Choose a registered active driver or leave the job unassigned");
    }
    private void requireDriverShift(Connection c, Long driver, String slot) throws SQLException {
        if (driver == null) return;
        try (PreparedStatement s = c.prepareStatement("SELECT shift_id FROM shift WHERE staff_id = ? AND shift_date = ? AND start_time <= ? AND end_time > ? LIMIT 1")) {
            s.setLong(1, driver); s.setString(2, parseDate(slot).toString());
            s.setString(3, parseTime(slot).toString()); s.setString(4, parseTime(slot).toString());
            try (ResultSet r = s.executeQuery()) { if (r.next()) return; }
        }
        throw new IllegalArgumentException("The driver needs a shift covering the scheduled date and time");
    }
    public List<java.util.Map<String, Object>> getDrivers() throws SQLException {
        List<java.util.Map<String, Object>> results = new ArrayList<>();
        try (Connection c = DBConnection.getConnection(); PreparedStatement s = c.prepareStatement("SELECT u.email, u.full_name FROM staff s JOIN users u ON u.user_id = s.user_id JOIN staff_role sr ON sr.staff_id = s.user_id AND sr.status = 'ACTIVE' JOIN role r ON r.role_id = sr.role_id WHERE s.work_status = 'ACTIVE' AND u.status = 'ACTIVE' AND r.role_name = 'DRIVER' ORDER BY u.full_name"); ResultSet r = s.executeQuery()) {
            while (r.next()) results.add(java.util.Map.of("email", r.getString(1), "name", r.getString(2)));
        }
        return results;
    }

    private String resolveAddress(Connection conn, Long orderId) throws SQLException {
        String sql = """
                SELECT CONCAT_WS(', ', c.street, c.city, c.postal_code)
                  FROM orders o
                  JOIN customer c ON c.user_id = o.customer_id
                 WHERE o.order_id = ?
                """;
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, orderId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next() && rs.getString(1) != null && !rs.getString(1).isBlank()) {
                    return rs.getString(1);
                }
            }
        }
        return "Main Branch collection desk";
    }

    public static java.time.LocalDateTime parseSlot(String value) {
        try { return java.time.LocalDateTime.parse(value.trim().replace(' ', 'T')); }
        catch (Exception ex) { throw new IllegalArgumentException("Select a valid delivery date and time"); }
    }
    private static LocalDate parseDate(String value) { return parseSlot(value).toLocalDate(); }
    private static LocalTime parseTime(String value) { return parseSlot(value).toLocalTime(); }

    private static String mapStatus(String status) {
        if (status == null || status.isBlank() || "Scheduled".equalsIgnoreCase(status)) {
            return "SCHEDULED";
        }
        String s = status.trim().replace(' ', '_').toUpperCase(Locale.ROOT);
        return switch (s) {
            case "PENDING", "ASSIGNED" -> "SCHEDULED";
            case "PICKED", "PICKEDUP", "PICKED_UP" -> "PICKED_UP";
            case "TRANSIT", "INTRANSIT", "IN_TRANSIT" -> "IN_TRANSIT";
            case "DONE", "COMPLETE", "COMPLETED", "DELIVERED" -> "DELIVERED";
            case "FAIL", "FAILED", "MISSED" -> "FAILED";
            case "CANCEL", "CANCELED", "CANCELLED" -> "CANCELLED";
            default -> s;
        };
    }
}
