package com.laundry.modules.dasanayaka.service;

import com.laundry.modules.dasanayaka.database.GarmentDBO;
import com.laundry.modules.dasanayaka.model.Garment;
import com.laundry.config.DBConnection;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;

@Service
public class GarmentService {

    private final GarmentDBO dbo;

    public GarmentService(GarmentDBO dbo) {
        this.dbo = dbo;
    }

    public Garment tagGarment(Garment g) {
        validate(g);
        try {
            DBConnection.requireOrder(g.getOrderId());
            Long id = dbo.insertGarment(g);
            return getGarment(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not tag garment", e);
        }
    }

    public List<Garment> getAllGarments() {
        try {
            return dbo.getAllGarments();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load garments", e);
        }
    }

    public Garment getGarment(Long id) {
        try {
            Garment g = dbo.getGarmentById(id);
            if (g == null) {
                throw new IllegalArgumentException("Garment not found");
            }
            DBConnection.requireOrder(g.getOrderId());
            return g;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load garment", e);
        }
    }

    public List<Garment> getGarmentsByOrder(Long orderId) {
        try {
            DBConnection.requireOrder(orderId);
            return dbo.getGarmentsByOrderId(orderId);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load garments for order", e);
        }
    }

    public Garment updateGarment(Long id, Garment u) {
        Garment g = getGarment(id);
        validate(u);
        if (!g.getOrderId().equals(u.getOrderId()))
            throw new IllegalArgumentException("The order of a garment cannot be changed");
        if (!g.getServiceId().equals(u.getServiceId()))
            throw new IllegalArgumentException("Remove and retag an uninvoiced garment to change its service");
        g.setGarmentType(u.getGarmentType());
        g.setQuantity(u.getQuantity());
        g.setFabricType(u.getFabricType());
        g.setCareInstructions(u.getCareInstructions());
        g.setDamaged(u.isDamaged());
        try {
            dbo.updateGarment(id, g);
            DBConnection.requireOrder(g.getOrderId());
            return getGarment(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update garment", e);
        }
    }

    public Garment flagDamage(Long id, boolean damaged) {
        getGarment(id);
        try {
            if (!dbo.flagDamage(id, damaged)) {
                throw new IllegalArgumentException("Garment was not found");
            }
            return getGarment(id);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not flag garment damage", e);
        }
    }

    public void removeGarment(Long id) {
        getGarment(id);
        try {
            if (!dbo.deleteGarment(id)) {
                throw new IllegalArgumentException("Garment was not found");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not remove garment", e);
        }
    }

    public List<java.util.Map<String, Object>> services() {
        try {
            return dbo.getServices();
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load services", e);
        }
    }

    public Garment reportException(Long id, String type, String description) {
        getGarment(id);
        if (type == null || !java.util.Set.of("DAMAGED", "MISSING").contains(type))
            throw new IllegalArgumentException("Choose damaged or missing");
        DBConnection.text(description, "Incident description", 3, 2000);
        try {
            dbo.reportException(id, type, description);
            return getGarment(id);
        } catch (SQLException ex) {
            throw new IllegalStateException("Could not report garment incident", ex);
        }
    }

    public static void validate(Garment g) {
        DBConnection.positiveId(g.getOrderId(), "Order");
        DBConnection.positiveId(g.getServiceId(), "Service");
        DBConnection.text(g.getFabricType(), "Fabric", 2, 50);
        DBConnection.text(g.getGarmentType(), "Garment type", 2, 50);
        if (g.getQuantity() < 1 || g.getQuantity() > 1000)
            throw new IllegalArgumentException("Quantity must be between 1 and 1000");
        if (g.getCareInstructions() != null && g.getCareInstructions().length() > 2000)
            throw new IllegalArgumentException("Care instructions must be at most 2000 characters");
    }

}
