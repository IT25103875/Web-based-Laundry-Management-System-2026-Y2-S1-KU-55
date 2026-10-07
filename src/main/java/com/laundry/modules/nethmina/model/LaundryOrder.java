package com.laundry.modules.nethmina.model;

import jakarta.persistence.*;

@Entity
@Table(name = "laundry_orders")
public class LaundryOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long customerId;
    private String serviceType;
    private String status = "Pending";
    private boolean isActive = true;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Long v) {
        customerId = v;
    }

    public String getServiceType() {
        return serviceType;
    }

    public void setServiceType(String v) {
        serviceType = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean v) {
        isActive = v;
    }
}
