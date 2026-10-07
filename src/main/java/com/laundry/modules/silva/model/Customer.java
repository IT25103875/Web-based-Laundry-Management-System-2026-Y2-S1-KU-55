package com.laundry.modules.silva.model;

import jakarta.persistence.*;

@Entity
@Table(name = "customers")
public class Customer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private String address;
    private String password;
    private boolean isActive = true;

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

    public String getPhone() {
        return phone;
    }

    public void setPhone(String v) {
        phone = v;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String v) {
        address = v;
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    public String getPassword() {
        return password;
    }

    public void setPassword(String v) {
        password = v;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean v) {
        isActive = v;
    }
}
