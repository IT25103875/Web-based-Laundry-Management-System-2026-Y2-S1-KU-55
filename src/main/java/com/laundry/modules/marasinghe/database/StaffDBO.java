package com.laundry.modules.marasinghe.database;

import com.laundry.config.DBConnection;
import com.laundry.config.PasswordUtil;
import com.laundry.modules.marasinghe.model.Employee;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@org.springframework.stereotype.Repository
public class StaffDBO {

    private static final String SELECT_COLS = """
            SELECT s.user_id AS id,
                   u.full_name,
                   u.email, u.phone, s.address, s.job_position, s.date_of_joining, s.salary, s.branch, s.department,
                   s.emergency_contact_name, s.emergency_contact_phone, s.supervisor_id,
                   latest.shift_id, latest.shift_date, latest.start_time, latest.end_time, latest.duty,
                   COALESCE(r.role_name, s.job_position) AS system_role,
                   COALESCE((
                        SELECT CONCAT(sh.shift_date, ' ', sh.start_time, '-', sh.end_time)
                          FROM shift sh
                         WHERE sh.staff_id = s.user_id
                         ORDER BY sh.shift_date DESC
                         LIMIT 1
                   ), s.job_position) AS shift_timing,
                   (s.work_status = 'ACTIVE' AND u.status = 'ACTIVE') AS is_active
              FROM staff s
              JOIN users u ON u.user_id = s.user_id
              LEFT JOIN staff_role sr ON sr.staff_id = s.user_id AND sr.status = 'ACTIVE'
              LEFT JOIN role r ON r.role_id = sr.role_id
              LEFT JOIN shift latest ON latest.shift_id = (SELECT sh.shift_id FROM shift sh WHERE sh.staff_id = s.user_id ORDER BY sh.shift_date DESC, sh.start_time DESC LIMIT 1)
            """;

    public Long insertEmployee(Employee e) throws SQLException {
        try (Connection c = DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                Long id;
                try (PreparedStatement s = c.prepareStatement("INSERT INTO users (full_name,email,phone,password_hash,user_type,must_change_password) VALUES (?,?,?,?,'STAFF',1)", Statement.RETURN_GENERATED_KEYS)) {
                    s.setString(1,e.getFullName()); s.setString(2,e.getEmail()); s.setString(3,e.getPhone());
                    s.setString(4, PasswordUtil.hash(e.getTemporaryPassword())); s.executeUpdate();
                    try (ResultSet keys = s.getGeneratedKeys()) { if (!keys.next()) throw new SQLException("No employee id returned"); id = keys.getLong(1); }
                }
                try (PreparedStatement s = c.prepareStatement("INSERT INTO staff (user_id,employee_no,address,job_position,date_of_joining,salary,branch,department,emergency_contact_name,emergency_contact_phone,supervisor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)")) {
                    s.setLong(1,id); s.setString(2,"EMP-"+id); setStaffFields(s,e,3); s.executeUpdate();
                }
                assignRole(c,id,toSchemaRole(e.getSystemRole()));
                insertShift(c,id,e);
                c.commit(); return id;
            } catch (SQLException | RuntimeException ex) { c.rollback(); throw ex; }
        }
    }
    private void setStaffFields(PreparedStatement s, Employee e, int start) throws SQLException {
        s.setString(start++, e.getAddress()); s.setString(start++, e.getJobPosition());
        s.setDate(start++, Date.valueOf(e.getDateOfJoining())); s.setBigDecimal(start++, e.getSalary());
        s.setString(start++,e.getBranch()); s.setString(start++, e.getDepartment());
        s.setString(start++, blankNull(e.getEmergencyContactName())); s.setString(start++, blankNull(e.getEmergencyContactPhone()));
        if (e.getSupervisorId() == null) s.setNull(start,Types.BIGINT); else s.setLong(start,e.getSupervisorId());
    }
    private static String blankNull(String v) { return v == null || v.isBlank() ? null : v; }

    public Employee getEmployeeById(Long id) throws SQLException {
        String sql = SELECT_COLS + " WHERE s.user_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public List<Employee> getAllActiveEmployees() throws SQLException {
        String sql = SELECT_COLS + " WHERE s.work_status = 'ACTIVE' AND u.status = 'ACTIVE' ORDER BY s.user_id";
        List<Employee> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) results.add(mapRow(rs));
        }
        return results;
    }

    public boolean updateEmployee(Long id, Employee e) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement u = conn.prepareStatement(
                        "UPDATE users SET full_name = ?, email = ?, phone = ? WHERE user_id = ?")) {
                    u.setString(1, e.getFullName());
                    u.setString(2, e.getEmail());
                    u.setString(3, e.getPhone()); u.setLong(4, id);
                    u.executeUpdate();
                }
                try (PreparedStatement s = conn.prepareStatement(
                        "UPDATE staff SET address=?,job_position=?,date_of_joining=?,salary=?,branch=?,department=?,emergency_contact_name=?,emergency_contact_phone=?,supervisor_id=? WHERE user_id=?")) {
                    setStaffFields(s,e,1); s.setLong(10,id);
                    s.executeUpdate();
                }
                assignRole(conn, id, toSchemaRole(e.getSystemRole()));
                insertShift(conn, id, e);
                conn.commit();
                return true;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public boolean revokeAccess(Long id) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement s = conn.prepareStatement(
                        "UPDATE staff SET work_status = 'INACTIVE' WHERE user_id = ?")) {
                    s.setLong(1, id);
                    s.executeUpdate();
                }
                try (PreparedStatement u = conn.prepareStatement(
                        "UPDATE users SET status = 'INACTIVE' WHERE user_id = ?")) {
                    u.setLong(1, id);
                    u.executeUpdate();
                }
                try (PreparedStatement r = conn.prepareStatement(
                        "UPDATE staff_role SET status = 'REVOKED' WHERE staff_id = ? AND status = 'ACTIVE'")) {
                    r.setLong(1, id);
                    r.executeUpdate();
                }
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

    public boolean deleteEmployee(Long id) throws SQLException {
        return revokeAccess(id);
    }

    public UserDetails findLoginUser(String email) throws SQLException {
        String sql = """
                SELECT u.email, u.password_hash, u.must_change_password, u.status, s.work_status, r.role_name
                  FROM users u
                  JOIN staff s ON s.user_id = u.user_id
                  LEFT JOIN staff_role sr ON sr.staff_id = s.user_id AND sr.status = 'ACTIVE'
                  LEFT JOIN role r ON r.role_id = sr.role_id
                 WHERE u.email = ? AND u.user_type = 'STAFF'
                """;
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, email);
            try (ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) return null;
                if (!"ACTIVE".equalsIgnoreCase(rs.getString("status"))
                        || !"ACTIVE".equalsIgnoreCase(rs.getString("work_status"))) {
                    return null;
                }
                if (rs.getString("role_name") == null) return null;
                String[] appRoles = rs.getBoolean("must_change_password") ? new String[]{"PASSWORD_CHANGE_REQUIRED"} : toAppRoles(rs.getString("role_name"));
                return User.withUsername(rs.getString("email"))
                        .password(rs.getString("password_hash"))
                        .roles(appRoles)
                        .build();
            }
        }
    }

    private void assignRole(Connection conn, Long staffId, String roleName) throws SQLException {
        Integer roleId = null;
        try (PreparedStatement find = conn.prepareStatement("SELECT role_id FROM role WHERE role_name = ?")) {
            find.setString(1, roleName);
            try (ResultSet rs = find.executeQuery()) {
                if (rs.next()) roleId = rs.getInt(1);
            }
        }
        if (roleId == null) throw new IllegalArgumentException("Role is not available in the current database");
        try (PreparedStatement s = conn.prepareStatement("SELECT role_id FROM staff_role WHERE staff_id = ? AND status = 'ACTIVE'")) {
            s.setLong(1,staffId); try (ResultSet r = s.executeQuery()) { if (r.next() && r.getInt(1) == roleId) return; }
        }
        try (PreparedStatement revoke = conn.prepareStatement(
                "UPDATE staff_role SET status = 'REVOKED' WHERE staff_id = ? AND status = 'ACTIVE'")) {
            revoke.setLong(1, staffId);
            revoke.executeUpdate();
        }
        try (PreparedStatement ins = conn.prepareStatement(
                "INSERT INTO staff_role (staff_id, role_id, status) VALUES (?, ?, 'ACTIVE')")) {
            ins.setLong(1, staffId);
            ins.setInt(2, roleId);
            ins.executeUpdate();
        }
    }

    private void insertShift(Connection conn, Long staffId, Employee e) throws SQLException {
        if (e.getShiftDate() == null || e.getShiftDate().isBlank()) return;
        if (e.getShiftId() != null) {
            try (PreparedStatement s = conn.prepareStatement("UPDATE shift SET shift_date=?,start_time=?,end_time=?,duty=? WHERE shift_id=? AND staff_id=?")) {
                s.setDate(1,Date.valueOf(e.getShiftDate())); s.setTime(2,Time.valueOf(java.time.LocalTime.parse(e.getStartTime())));
                s.setTime(3,Time.valueOf(java.time.LocalTime.parse(e.getEndTime()))); s.setString(4,e.getDuty());
                s.setLong(5,e.getShiftId()); s.setLong(6,staffId);
                if (s.executeUpdate() == 0) throw new IllegalArgumentException("Shift not found for this employee");
            }
        } else {
            try (PreparedStatement s = conn.prepareStatement("INSERT INTO shift (staff_id,shift_date,start_time,end_time,duty) VALUES (?,?,?,?,?)")) {
                s.setLong(1,staffId); s.setDate(2,Date.valueOf(e.getShiftDate())); s.setTime(3,Time.valueOf(java.time.LocalTime.parse(e.getStartTime())));
                s.setTime(4,Time.valueOf(java.time.LocalTime.parse(e.getEndTime()))); s.setString(5,e.getDuty()); s.executeUpdate();
            }
        }
    }
    public List<java.util.Map<String,Object>> getShifts(Long staffId) throws SQLException {
        List<java.util.Map<String,Object>> result = new ArrayList<>();
        try (Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("SELECT shift_id,shift_date,start_time,end_time,duty FROM shift WHERE staff_id=? ORDER BY shift_date DESC,start_time DESC")) {
            s.setLong(1,staffId); try (ResultSet r=s.executeQuery()) {
                while(r.next()) result.add(java.util.Map.of("id",r.getLong(1),"date",r.getString(2),"start",r.getString(3),"end",r.getString(4),"duty",r.getString(5)==null ? "" : r.getString(5)));
            }
        }
        return result;
    }

    public List<java.util.Map<String,Object>> audit(Long id) throws SQLException {
        List<java.util.Map<String,Object>> results=new ArrayList<>();
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("SELECT action,entity_name,occurred_at,old_value,new_value FROM audit_log WHERE (entity_name='staff' AND entity_id=?) OR (entity_name='users' AND entity_id=?) OR (entity_name='staff_role' AND entity_id IN (SELECT staff_role_id FROM staff_role WHERE staff_id=?)) ORDER BY audit_id DESC LIMIT 50")) {
            s.setLong(1,id); s.setLong(2,id); s.setLong(3,id);
            try(ResultSet r=s.executeQuery()) { while(r.next()) results.add(java.util.Map.of("action",r.getString(1),"entity",r.getString(2),"time",r.getString(3),"before",r.getString(4)==null?"—":r.getString(4),"after",r.getString(5)==null?"—":r.getString(5))); }
        }
        return results;
    }

    private Employee mapRow(ResultSet rs) throws SQLException {
        Employee e = new Employee();
        e.setId(rs.getLong("id"));
        e.setFullName(rs.getString("full_name"));
        e.setEmail(rs.getString("email"));
        e.setSystemRole(rs.getString("system_role"));
        e.setShiftTiming(rs.getString("shift_timing"));
        e.setActive(rs.getBoolean("is_active"));
        e.setPhone(rs.getString("phone")); e.setAddress(rs.getString("address")); e.setJobPosition(rs.getString("job_position"));
        e.setDateOfJoining(rs.getString("date_of_joining")); e.setSalary(rs.getBigDecimal("salary"));
        e.setBranch(rs.getString("branch")); e.setDepartment(rs.getString("department"));
        e.setEmergencyContactName(rs.getString("emergency_contact_name")); e.setEmergencyContactPhone(rs.getString("emergency_contact_phone"));
        e.setSupervisorId(rs.getObject("supervisor_id", Long.class)); e.setShiftId(rs.getObject("shift_id",Long.class));
        e.setShiftDate(rs.getString("shift_date")); e.setStartTime(rs.getString("start_time")); e.setEndTime(rs.getString("end_time")); e.setDuty(rs.getString("duty"));
        return e;
    }
    public static String[] toAppRoles(String role) {
        if ("CUSTOMER_SERVICE_OFFICER".equals(role)) return new String[]{"CUSTOMER_MANAGER","ORDER_MANAGER"};
        return new String[]{toAppRole(role)};
    }

    public static String toSchemaRole(String value) {
        if (value == null || value.isBlank()) return "WASHER";
        String s = value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        return switch (s) {
            case "ADMIN", "BUSINESS_OWNER", "OWNER" -> "BUSINESS_OWNER";
            case "BRANCH_MANAGER", "MANAGER" -> "BRANCH_MANAGER";
            case "CUSTOMER_MANAGER", "CUSTOMER_SERVICE_OFFICER", "CUSTOMER" -> "CUSTOMER_SERVICE_OFFICER";
            case "CASHIER", "PAYMENT_MANAGER", "PAYMENT" -> "CASHIER";
            case "DELIVERY_MANAGER", "DELIVERY_COORDINATOR", "DELIVERY" -> "DELIVERY_COORDINATOR";
            case "DRIVER" -> "DRIVER";
            case "WASHER", "GARMENT_MANAGER", "GARMENT" -> "WASHER";
            case "STAFF_MANAGER", "STAFF" -> "BRANCH_MANAGER";
            case "ORDER_MANAGER", "ORDERS" -> "CUSTOMER_SERVICE_OFFICER";
            default -> s;
        };
    }

    public static String toAppRole(String schemaRole) {
        if (schemaRole == null) return "STAFF_MANAGER";
        return switch (schemaRole.toUpperCase(Locale.ROOT)) {
            case "BUSINESS_OWNER" -> "ADMIN";
            case "BRANCH_MANAGER" -> "STAFF_MANAGER";
            case "CUSTOMER_SERVICE_OFFICER" -> "CUSTOMER_MANAGER";
            case "CASHIER" -> "PAYMENT_MANAGER";
            case "DELIVERY_COORDINATOR" -> "DELIVERY_MANAGER";
            case "DRIVER" -> "DELIVERY_MANAGER";
            case "WASHER" -> "GARMENT_MANAGER";
            default -> "STAFF_MANAGER";
        };
    }

}
