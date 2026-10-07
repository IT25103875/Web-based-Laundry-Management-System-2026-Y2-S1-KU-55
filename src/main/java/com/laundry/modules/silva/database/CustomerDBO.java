package com.laundry.modules.silva.database;

import com.laundry.config.DBConnection;
import com.laundry.config.PasswordUtil;
import com.laundry.modules.silva.model.Customer;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

@org.springframework.stereotype.Repository
public class CustomerDBO {

    public Long insertCustomer(Customer c) throws SQLException {
        String phone = normalizePhone(c.getPhone());
        String hash = PasswordUtil.hash(c.getPassword());
        String street = c.getAddress() == null || c.getAddress().isBlank() ? "Not provided" : c.getAddress();
        try (Connection conn = DBConnection.getConnection();
             CallableStatement stmt = conn.prepareCall("{CALL sp_register_customer(?,?,?,?,?,?,?,?,?)}")) {
            stmt.setString(1, c.getFullName());
            stmt.setString(2, emptyToNull(c.getEmail()));
            stmt.setString(3, phone);
            stmt.setString(4, hash);
            stmt.setString(5, street);
            stmt.setString(6, "Colombo");
            stmt.setString(7, null);
            stmt.setString(8, null);
            stmt.registerOutParameter(9, Types.BIGINT);
            stmt.execute();
            return stmt.getLong(9);
        }
    }

    public Customer getCustomerById(Long id) throws SQLException {
        String sql = """
                SELECT u.user_id AS id, u.full_name, u.email, u.phone,
                       c.street AS address,
                       u.password_hash AS password, (u.status = 'ACTIVE') AS is_active
                  FROM users u JOIN customer c ON c.user_id = u.user_id
                 WHERE u.user_id = ?
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

    public Customer getCustomerByEmail(String email) throws SQLException {
        String sql = """
                SELECT u.user_id AS id, u.full_name, u.email, u.phone,
                       c.street AS address,
                       u.password_hash AS password, (u.status = 'ACTIVE') AS is_active
                  FROM users u JOIN customer c ON c.user_id = u.user_id
                 WHERE u.email = ?
                """;
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, email);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public List<Customer> getAllActiveCustomers() throws SQLException {
        String sql = """
                SELECT u.user_id AS id, u.full_name, u.email, u.phone,
                       c.street AS address,
                       u.password_hash AS password, (u.status = 'ACTIVE') AS is_active
                  FROM users u JOIN customer c ON c.user_id = u.user_id
                 WHERE u.status = 'ACTIVE'
                 ORDER BY u.user_id
                """;
        List<Customer> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) results.add(mapRow(rs));
        }
        return results;
    }

    public boolean updateCustomer(Long id, Customer c) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement u = conn.prepareStatement(
                        "UPDATE users SET full_name = ?, email = ?, phone = ? WHERE user_id = ?")) {
                    u.setString(1, c.getFullName());
                    u.setString(2, emptyToNull(c.getEmail()));
                    u.setString(3, normalizePhone(c.getPhone()));
                    u.setLong(4, id);
                    u.executeUpdate();
                }
                try (PreparedStatement s = conn.prepareStatement(
                        "UPDATE customer SET street = ? WHERE user_id = ?")) {
                    s.setString(1, c.getAddress() == null ? "Not provided" : c.getAddress());
                    s.setLong(2, id);
                    s.executeUpdate();
                }
                if (c.getPassword() != null && !c.getPassword().isBlank()) {
                    try (CallableStatement pw = conn.prepareCall("{CALL sp_change_password(?,?)}")) {
                        pw.setLong(1, id);
                        pw.setString(2, PasswordUtil.hash(c.getPassword()));
                        pw.execute();
                    }
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

    public boolean archiveCustomer(Long id) throws SQLException {
        String sql = "UPDATE users SET status = 'ARCHIVED' WHERE user_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            return stmt.executeUpdate() > 0;
        }
    }

    public boolean updatePassword(Long id, String rawPassword) throws SQLException {
        try (Connection conn = DBConnection.getConnection();
             CallableStatement stmt = conn.prepareCall("{CALL sp_change_password(?,?)}")) {
            stmt.setLong(1, id);
            stmt.setString(2, PasswordUtil.hash(rawPassword));
            stmt.execute();
            return true;
        }
    }

    public List<java.util.Map<String,Object>> notifications(Long id) throws SQLException {
        List<java.util.Map<String,Object>> results=new ArrayList<>();
        try(Connection c=DBConnection.getConnection(); PreparedStatement s=c.prepareStatement("SELECT notification_id,related_order_id,message_type FROM notification WHERE user_id=? ORDER BY notification_id DESC LIMIT 30")) {
            s.setLong(1,id); try(ResultSet r=s.executeQuery()) {
                while(r.next()) {
                    java.util.Map<String,Object> row=new java.util.LinkedHashMap<>();
                    row.put("id",r.getLong(1)); row.put("orderId",r.getObject(2)); row.put("type",r.getString(3)); results.add(row);
                }
            }
        }
        return results;
    }

    private Customer mapRow(ResultSet rs) throws SQLException {
        Customer c = new Customer();
        c.setId(rs.getLong("id"));
        c.setFullName(rs.getString("full_name"));
        c.setEmail(rs.getString("email"));
        c.setPhone(rs.getString("phone"));
        c.setAddress(rs.getString("address"));
        c.setPassword(rs.getString("password"));
        c.setActive(rs.getBoolean("is_active"));
        return c;
    }

    private static String emptyToNull(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private static String normalizePhone(String phone) {
        DBConnection.phone(phone);
        return phone.trim().replaceAll("[\\s()-]", "");
    }
}
