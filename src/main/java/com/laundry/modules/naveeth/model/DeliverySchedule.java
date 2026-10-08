package com.laundry.modules.naveeth.model;

import jakarta.persistence.*;

@Entity
@Table(name = "deliveries")
public class DeliverySchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long orderId;
    private String driverName;
    private String timeSlot;
    private String status = "Scheduled";
    private String deliveryType = "DROP_OFF";
    public String getDeliveryType() { return deliveryType; }
    public void setDeliveryType(String value) { deliveryType = value; }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long v) {
        orderId = v;
    }

    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String v) {
        driverName = v;
    }

    public String getTimeSlot() {
        return timeSlot;
    }

    public void setTimeSlot(String v) {
        timeSlot = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }
}
