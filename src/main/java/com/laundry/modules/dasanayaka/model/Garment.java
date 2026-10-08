package com.laundry.modules.dasanayaka.model;

import jakarta.persistence.*;

@Entity
@Table(name = "garments")
public class Garment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long orderId;
    private String fabricType;
    private String careInstructions;
    private boolean isDamaged = false;
    private boolean missing;
    public boolean isMissing() { return missing; }
    public void setMissing(boolean value) { missing = value; }

    private Long serviceId;
    private String garmentType;
    private int quantity = 1;
    private double unitPrice;
    public Long getServiceId() { return serviceId; }
    public void setServiceId(Long v) { serviceId = v; }
    public String getGarmentType() { return garmentType; }
    public void setGarmentType(String v) { garmentType = v; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int v) { quantity = v; }
    public double getUnitPrice() { return unitPrice; }
    public void setUnitPrice(double v) { unitPrice = v; }

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

    public String getFabricType() {
        return fabricType;
    }

    public void setFabricType(String v) {
        fabricType = v;
    }

    public String getCareInstructions() {
        return careInstructions;
    }

    public void setCareInstructions(String v) {
        careInstructions = v;
    }

    public boolean isDamaged() {
        return isDamaged;
    }

    public void setDamaged(boolean v) {
        isDamaged = v;
    }
}
