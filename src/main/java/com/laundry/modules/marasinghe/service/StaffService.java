package com.laundry.modules.marasinghe.service;

import com.laundry.modules.marasinghe.database.StaffDBO;
import com.laundry.modules.marasinghe.model.Employee;
import com.laundry.config.DBConnection;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;
import java.util.Set;

@Service
public class StaffService {
    private static final Set<String> ALLOWED_ROLES = Set.of(
            "Admin", "Washer", "Driver",
            "BUSINESS_OWNER", "BRANCH_MANAGER", "CUSTOMER_SERVICE_OFFICER",
            "CASHIER", "DELIVERY_COORDINATOR", "DRIVER", "WASHER");

    private final StaffDBO dbo;

    public StaffService(StaffDBO dbo) { this.dbo = dbo; }

    public Employee createEmployee(Employee e) {
        validateEmployee(e);
        DBConnection.text(e.getTemporaryPassword(), "Temporary password", 8, 72);
        try {
            Long id = dbo.insertEmployee(e);
            e.setId(id);
            return getEmployee(id);
        } catch (SQLException ex) {
            throw new IllegalStateException("Could not onboard employee", ex);
        }
    }

    public List<Employee> getAllActiveEmployees() {
        try {
            return dbo.getAllActiveEmployees();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load staff directory", e);
        }
    }

    public Employee getEmployee(Long id) {
        try {
            Employee e = dbo.getEmployeeById(id);
            if (e == null) {
                throw new IllegalArgumentException("Employee not found");
            }
            return e;
        } catch (SQLException ex) {
            throw new IllegalStateException("Could not load employee", ex);
        }
    }

    public Employee updateEmployee(Long id, Employee u) {
        Employee e = getEmployee(id);
        u.setId(id);
        validateEmployee(u);
        if (u.getShiftId() != null && !u.getShiftId().equals(e.getShiftId())) throw new IllegalArgumentException("Select the current shift or create a new shift");
        u.setId(id);
        try {
            dbo.updateEmployee(id, u);
            return getEmployee(id);
        } catch (SQLException ex) {
            throw new IllegalStateException("Could not update employee", ex);
        }
    }

    public void revokeAccess(Long id) {
        getEmployee(id);
        try (var conn = DBConnection.getConnection()) {
            if (DBConnection.staffActor(conn).equals(id)) throw new IllegalArgumentException("You cannot revoke your own access");
            if (!dbo.revokeAccess(id)) {
                throw new IllegalArgumentException("Staff member was not found");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not revoke staff access", e);
        }
    }

    public List<java.util.Map<String,Object>> shifts(Long id) {
        getEmployee(id);
        try { return dbo.getShifts(id); } catch (SQLException ex) { throw new IllegalStateException("Could not load shifts",ex); }
    }
    public List<java.util.Map<String,Object>> audit(Long id) {
        getEmployee(id);
        try { return dbo.audit(id); } catch(SQLException ex) { throw new IllegalStateException("Could not load staff audit",ex); }
    }
    public static void validateEmployee(Employee e) {
        DBConnection.text(e.getFullName(), "Full name", 2,100); DBConnection.email(e.getEmail()); DBConnection.phone(e.getPhone());
        e.setPhone(e.getPhone().trim().replaceAll("[\\s()-]",""));
        DBConnection.text(e.getAddress(),"Address",3,255); DBConnection.text(e.getJobPosition(),"Job position",2,50);
        DBConnection.text(e.getBranch(),"Branch",2,60);
        if (!ALLOWED_ROLES.contains(StaffDBO.toSchemaRole(e.getSystemRole()))) throw new IllegalArgumentException("Select a valid staff role");
        if (e.getSystemRole() == null || e.getSystemRole().isBlank()) throw new IllegalArgumentException("Role is required");
        try { java.time.LocalDate.parse(e.getDateOfJoining()); } catch(Exception ex) { throw new IllegalArgumentException("Select a valid joining date"); }
        if (e.getSalary()!=null && (e.getSalary().signum()<0 || e.getSalary().compareTo(new java.math.BigDecimal("9999999999.99"))>0)) throw new IllegalArgumentException("Salary must be a valid non-negative amount");
        if (e.getDepartment()!=null && e.getDepartment().length()>60) throw new IllegalArgumentException("Department must be at most 60 characters");
        if (e.getEmergencyContactName()!=null && e.getEmergencyContactName().length()>100) throw new IllegalArgumentException("Emergency contact name must be at most 100 characters");
        if (e.getEmergencyContactPhone()!=null && !e.getEmergencyContactPhone().isBlank()) DBConnection.phone(e.getEmergencyContactPhone());
        if (e.getSupervisorId()!=null && e.getSupervisorId().equals(e.getId())) throw new IllegalArgumentException("An employee cannot supervise themselves");
        if (e.getShiftDate()!=null && !e.getShiftDate().isBlank()) {
            try {
                java.time.LocalDate.parse(e.getShiftDate());
                if (!java.time.LocalTime.parse(e.getEndTime()).isAfter(java.time.LocalTime.parse(e.getStartTime()))) throw new Exception();
            } catch(Exception ex) { throw new IllegalArgumentException("Choose a shift date with an end time after its start time"); }
        } else if ((e.getStartTime()!=null && !e.getStartTime().isBlank()) || (e.getEndTime()!=null && !e.getEndTime().isBlank())) throw new IllegalArgumentException("Shift date is required when entering shift times");
        if (e.getDuty()!=null && e.getDuty().length()>100) throw new IllegalArgumentException("Duty must be at most 100 characters");
    }
}
