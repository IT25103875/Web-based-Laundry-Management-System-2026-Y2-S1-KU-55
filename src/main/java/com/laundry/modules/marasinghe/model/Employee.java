package com.laundry.modules.marasinghe.model;

import jakarta.persistence.*;

@Entity
@Table(name = "employees")
public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String fullName;
    private String email;
    private String systemRole;
    private String shiftTiming;
    private boolean isActive = true;

    private String phone;
    public String getPhone() { return phone; }
    public void setPhone(String v) { phone = v; }
    private String address;
    public String getAddress() { return address; }
    public void setAddress(String v) { address = v; }
    private String jobPosition;
    public String getJobPosition() { return jobPosition; }
    public void setJobPosition(String v) { jobPosition = v; }
    private String dateOfJoining;
    public String getDateOfJoining() { return dateOfJoining; }
    public void setDateOfJoining(String v) { dateOfJoining = v; }
    private String branch;
    public String getBranch() { return branch; }
    public void setBranch(String v) { branch = v; }
    private String department;
    public String getDepartment() { return department; }
    public void setDepartment(String v) { department = v; }
    private String emergencyContactName;
    public String getEmergencyContactName() { return emergencyContactName; }
    public void setEmergencyContactName(String v) { emergencyContactName = v; }
    private String emergencyContactPhone;
    public String getEmergencyContactPhone() { return emergencyContactPhone; }
    public void setEmergencyContactPhone(String v) { emergencyContactPhone = v; }
    private String shiftDate;
    public String getShiftDate() { return shiftDate; }
    public void setShiftDate(String v) { shiftDate = v; }
    private String startTime;
    public String getStartTime() { return startTime; }
    public void setStartTime(String v) { startTime = v; }
    private String endTime;
    public String getEndTime() { return endTime; }
    public void setEndTime(String v) { endTime = v; }
    private String duty;
    public String getDuty() { return duty; }
    public void setDuty(String v) { duty = v; }
    private String temporaryPassword;
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    public String getTemporaryPassword() { return temporaryPassword; }
    public void setTemporaryPassword(String v) { temporaryPassword = v; }
    private java.math.BigDecimal salary;
    public java.math.BigDecimal getSalary() { return salary; }
    public void setSalary(java.math.BigDecimal v) { salary = v; }
    private Long supervisorId;
    public Long getSupervisorId() { return supervisorId; }
    public void setSupervisorId(Long v) { supervisorId = v; }
    private Long shiftId;
    public Long getShiftId() { return shiftId; }
    public void setShiftId(Long v) { shiftId = v; }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String v) {
        fullName = v;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String v) {
        email = v;
    }

    public String getSystemRole() {
        return systemRole;
    }

    public void setSystemRole(String v) {
        systemRole = v;
    }

    public String getShiftTiming() {
        return shiftTiming;
    }

    public void setShiftTiming(String v) {
        shiftTiming = v;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean v) {
        isActive = v;
    }
}
