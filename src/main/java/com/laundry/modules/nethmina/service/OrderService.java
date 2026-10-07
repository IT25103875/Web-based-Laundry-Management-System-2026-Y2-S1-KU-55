package com.laundry.modules.nethmina.service;

import com.laundry.modules.nethmina.database.OrderDBO;
import com.laundry.modules.nethmina.model.LaundryOrder;
import com.laundry.config.DBConnection;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;

@Service
public class OrderService {

    private final OrderDBO dbo;

    public OrderService(OrderDBO dbo) { this.dbo = dbo; }

    public LaundryOrder createOrder(LaundryOrder o) {
        validate(o);
        if (!"Pending".equalsIgnoreCase(o.getStatus()) && !"RECEIVED".equals(o.getStatus())) throw new IllegalArgumentException("New orders must start as received");
        try {
            DBConnection.requireCustomer(o.getCustomerId());
            Long id = dbo.insertOrder(o);
            o.setId(id);
            return getOrder(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not create order", e);
        }
    }

    public List<LaundryOrder> getOrders() {
        try {
            return DBConnection.isCustomer() ? dbo.getOrdersByCustomerId(DBConnection.currentCustomerId()) : dbo.getAllOrders();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load orders", e);
        }
    }

    public List<LaundryOrder> getOrdersByCustomer(Long customerId) {
        try {
            DBConnection.requireCustomer(customerId);
            return dbo.getOrdersByCustomerId(customerId);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load orders for customer", e);
        }
    }

    public LaundryOrder getOrder(Long id) {
        try {
            LaundryOrder o = dbo.getOrderById(id);
            if (o == null) {
                throw new IllegalArgumentException("Order not found");
            }
            DBConnection.requireCustomer(o.getCustomerId());
            return o;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load order", e);
        }
    }

    public LaundryOrder updateOrder(Long id, LaundryOrder u) {
        LaundryOrder o = getOrder(id);
        validate(u);
        if (!o.getCustomerId().equals(u.getCustomerId())) throw new IllegalArgumentException("The customer of an order cannot be changed");
        if (DBConnection.isCustomer() && !"RECEIVED".equals(o.getStatus())) throw new IllegalArgumentException("Only received orders can be edited");
        if (!"RECEIVED".equals(o.getStatus()) && !java.util.Objects.equals(o.getServiceType(),u.getServiceType())) throw new IllegalArgumentException("Service notes can only be changed before processing starts");
        o.setServiceType(u.getServiceType());
        if (!DBConnection.isCustomer()) {
            validateTransition(o.getStatus(), u.getStatus());
            o.setStatus(u.getStatus());
        }
        try {
            if ("COMPLETED".equals(o.getStatus()) && !dbo.isPaid(id)) throw new IllegalArgumentException("Record payment before completing the order");
            dbo.updateOrder(id, o);
            return o;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update order", e);
        }
    }

    public LaundryOrder updateStatus(Long id, String status) {
        LaundryOrder existing = getOrder(id);
        if ("CANCELLED".equalsIgnoreCase(status) || "Cancel".equalsIgnoreCase(status)) { cancelOrder(id); return getOrder(id); }
        validateTransition(existing.getStatus(),status);
        try {
            if ("COMPLETED".equals(status) && !dbo.isPaid(id)) throw new IllegalArgumentException("Record payment before completing the order");
            if (!dbo.updateStatus(id, status)) {
                throw new IllegalArgumentException("Order not found");
            }
            return getOrder(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update order status", e);
        }
    }

    public void cancelOrder(Long id) {
        LaundryOrder order = getOrder(id);
        if (!"RECEIVED".equals(order.getStatus())) throw new IllegalArgumentException("Only received orders can be cancelled");
        try {
            if (!dbo.cancelOrder(id)) {
                throw new IllegalArgumentException("Order was not found");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not cancel order", e);
        }
    }
    public LaundryOrder book(LaundryOrder o, com.laundry.modules.dasanayaka.model.Garment g, com.laundry.modules.naveeth.model.DeliverySchedule d) {
        validate(o);
        o.setStatus("RECEIVED");
        g.setOrderId(1L); d.setOrderId(1L); // IDs are replaced after insert within the transaction.
        com.laundry.modules.dasanayaka.service.GarmentService.validate(g);
        com.laundry.modules.naveeth.service.DeliveryService.validate(d, true);
        if (g.isDamaged()) throw new IllegalArgumentException("Staff must inspect and report garment incidents");
        d.setDriverName("Unassigned"); d.setStatus("SCHEDULED");
        try {
            DBConnection.requireCustomer(o.getCustomerId());
            Long id = dbo.book(o, g, d);
            return getOrder(id);
        } catch (SQLException ex) { throw new IllegalStateException("Could not save booking; no partial booking was saved", ex); }
    }
    public static void validateTransition(String previous,String next) {
        if(next == null || next.isBlank()) throw new IllegalArgumentException("Order stage is required");
        if(previous.equals(next)) return;
        var allowed = switch(previous) {
            case "RECEIVED" -> java.util.Set.of("IN_WASHING","IN_DRY_CLEANING","IN_IRONING");
            case "IN_WASHING", "IN_DRY_CLEANING" -> java.util.Set.of("IN_IRONING","QUALITY_CHECKED");
            case "IN_IRONING" -> java.util.Set.of("QUALITY_CHECKED");
            case "QUALITY_CHECKED" -> java.util.Set.of("READY_FOR_COLLECTION");
            case "READY_FOR_COLLECTION" -> java.util.Set.of("OUT_FOR_DELIVERY","COMPLETED");
            case "OUT_FOR_DELIVERY" -> java.util.Set.of("READY_FOR_COLLECTION","COMPLETED");
            default -> java.util.Set.<String>of();
        };
        if (!allowed.contains(next)) throw new IllegalArgumentException("Choose the next valid order stage; processing, quality checking and readiness must happen in sequence");
    }
    public static void validate(LaundryOrder o) {
        DBConnection.positiveId(o.getCustomerId(), "Customer");
        DBConnection.text(o.getServiceType(), "Service", 2, 255);
    }

}
