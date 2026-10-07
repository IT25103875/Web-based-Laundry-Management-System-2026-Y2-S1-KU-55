package com.laundry.modules.silva.service;

import com.laundry.modules.silva.database.CustomerDBO;
import com.laundry.modules.silva.model.Customer;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;

@Service
public class CustomerService {
    private final CustomerDBO dbo;

    public CustomerService(CustomerDBO dbo) { this.dbo = dbo; }

    public Customer registerCustomer(Customer c) {
        validate(c, true);
        if (c.getEmail() == null || c.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        try {
            if (dbo.getCustomerByEmail(c.getEmail()) != null) {
                throw new IllegalArgumentException("A customer account already exists for this email");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not check existing customer", e);
        }
        try {
            Long id = dbo.insertCustomer(c);
            return getCustomer(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not register customer", e);
        }
    }

    public List<Customer> getActiveCustomers() {
        try {
            return dbo.getAllActiveCustomers();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load customers", e);
        }
    }

    public Customer getCustomer(Long id) {
        try {
            Customer c = dbo.getCustomerById(id);
            if (c == null) {
                throw new IllegalArgumentException("Customer not found");
            }
            return c;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load customer", e);
        }
    }

    public Customer getCustomerByEmail(String email) {
        try {
            Customer c = dbo.getCustomerByEmail(email);
            if (c == null) {
                throw new IllegalArgumentException("Customer not found");
            }
            return c;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load customer", e);
        }
    }

    public Customer updateCustomerByEmail(String email, Customer u) {
        Customer c = getCustomerByEmail(email);
        return applyUpdate(c, u);
    }

    public Customer updateCustomer(Long id, Customer u) {
        Customer c = getCustomer(id);
        return applyUpdate(c, u);
    }

    private Customer applyUpdate(Customer c, Customer u) {
        validate(u, false);
        // A stored hash must never be passed back as a new raw password.
        c.setPassword(null);
        c.setFullName(u.getFullName());
        c.setEmail(u.getEmail());
        c.setPhone(u.getPhone());
        c.setAddress(u.getAddress());
        try {
            if (u.getPassword() != null && !u.getPassword().isBlank()) {
                c.setPassword(u.getPassword());
            }
            dbo.updateCustomer(c.getId(), c);
            return c;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update customer", e);
        }
    }

    public void archiveCustomer(Long id) {
        try {
            if (!dbo.archiveCustomer(id)) {
                throw new IllegalArgumentException("Customer was not found");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not archive customer", e);
        }
    }
    public static void validate(Customer c, boolean creating) {
        com.laundry.config.DBConnection.text(c.getFullName(), "Full name", 2, 100);
        com.laundry.config.DBConnection.email(c.getEmail());
        com.laundry.config.DBConnection.phone(c.getPhone());
        com.laundry.config.DBConnection.text(c.getAddress(), "Address", 3, 150);
        if (creating || (c.getPassword() != null && !c.getPassword().isBlank()))
            com.laundry.config.DBConnection.text(c.getPassword(), "Password", 8, 72);
    }

    public List<java.util.Map<String,Object>> notifications(String email) {
        Customer c = getCustomerByEmail(email);
        try { return dbo.notifications(c.getId()); } catch(SQLException ex) { throw new IllegalStateException("Could not load notifications",ex); }
    }

}
