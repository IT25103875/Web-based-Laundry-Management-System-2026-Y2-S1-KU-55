package com.laundry.modules.naveeth.service;

import com.laundry.modules.naveeth.database.DeliveryDBO;
import com.laundry.modules.naveeth.model.DeliverySchedule;
import com.laundry.config.DBConnection;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;

@Service
public class DeliveryService {

    private final DeliveryDBO dbo;

    public DeliveryService(DeliveryDBO dbo) { this.dbo = dbo; }

    public DeliverySchedule schedule(DeliverySchedule s) {
        validate(s, true);
        if (s.getStatus() == null || !java.util.Set.of("Scheduled","SCHEDULED").contains(s.getStatus())) throw new IllegalArgumentException("New deliveries must start as scheduled");
        try {
            DBConnection.requireOrder(s.getOrderId());
            Long id = dbo.insertDelivery(s);
            s.setId(id);
            return getSchedule(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not schedule delivery", e);
        }
    }

    public List<DeliverySchedule> getAllSchedules() {
        try {
            return dbo.getAllSchedules();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load deliveries", e);
        }
    }

    public List<DeliverySchedule> getSchedulesByOrder(Long orderId) {
        try {
            DBConnection.requireOrder(orderId);
            return dbo.getSchedulesByOrderId(orderId);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load deliveries for order", e);
        }
    }

    public DeliverySchedule getSchedule(Long id) {
        try {
            DeliverySchedule d = dbo.getDeliveryById(id);
            if (d == null) {
                throw new IllegalArgumentException("Delivery not found");
            }
            DBConnection.requireOrder(d.getOrderId());
            return d;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load delivery", e);
        }
    }

    public DeliverySchedule updateSchedule(Long id, DeliverySchedule u) {
        DeliverySchedule d = getSchedule(id);
        if (!d.getOrderId().equals(u.getOrderId())) throw new IllegalArgumentException("The order of a delivery cannot be changed");
        validate(u, !DeliveryDBO.parseSlot(d.getTimeSlot()).equals(DeliveryDBO.parseSlot(u.getTimeSlot())));
        if (!d.getDeliveryType().equals(u.getDeliveryType())) throw new IllegalArgumentException("The delivery type cannot be changed; cancel and reschedule if needed");
        d.setDriverName(u.getDriverName());
        d.setTimeSlot(u.getTimeSlot());
        d.setStatus(u.getStatus());
        try {
            dbo.updateDelivery(id, d);
            DBConnection.requireOrder(d.getOrderId());
            return getSchedule(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update delivery", e);
        }
    }

    public DeliverySchedule updateStatus(Long id, String status) {
        getSchedule(id);
        try {
            if (!dbo.updateStatus(id, status)) {
                throw new IllegalArgumentException("Delivery was not found");
            }
            return getSchedule(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update delivery status", e);
        }
    }

    public void cancelSchedule(Long id) {
        getSchedule(id);
        try {
            if (!dbo.cancelSchedule(id)) {
                throw new IllegalArgumentException("Delivery was not found");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not cancel delivery", e);
        }
    }
    public List<java.util.Map<String, Object>> drivers() {
        try { return dbo.getDrivers(); } catch (SQLException ex) { throw new IllegalStateException("Could not load drivers", ex); }
    }
    public java.util.Map<String,Object> detail(Long id) {
        getSchedule(id);
        try { return dbo.detail(id); } catch(SQLException ex) { throw new IllegalStateException("Could not load delivery history",ex); }
    }
    public void reportIncident(Long id,String description) {
        getSchedule(id); DBConnection.text(description,"Incident description",3,2000);
        try { dbo.reportIncident(id,description); } catch(SQLException ex) { throw new IllegalStateException("Could not report delivery incident",ex); }
    }
    public void resolveIncident(Long id,Long incidentId) {
        getSchedule(id); DBConnection.positiveId(incidentId,"Incident");
        try { dbo.resolveIncident(id,incidentId); } catch(SQLException ex) { throw new IllegalStateException("Could not resolve incident",ex); }
    }
    public static void validate(DeliverySchedule d, boolean requireFuture) {
        DBConnection.positiveId(d.getOrderId(), "Order");
        if (d.getDeliveryType() == null || !java.util.Set.of("PICKUP","DROP_OFF").contains(d.getDeliveryType())) throw new IllegalArgumentException("Choose pickup or drop-off");
        var slot = DeliveryDBO.parseSlot(d.getTimeSlot());
        if (requireFuture && !slot.isAfter(java.time.LocalDateTime.now())) throw new IllegalArgumentException("Delivery date and time must be in the future");
    }

}
