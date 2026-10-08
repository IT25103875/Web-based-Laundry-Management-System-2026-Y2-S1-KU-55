package com.laundry.modules.dasanayaka.controller;

import com.laundry.modules.dasanayaka.model.Garment;
import com.laundry.modules.dasanayaka.service.GarmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/garments")
@CrossOrigin(origins = "http://localhost:5173")
public class GarmentController {
    @Autowired
    private GarmentService service;

    @GetMapping("/services")
    public java.util.List<java.util.Map<String, Object>> services() {
        return service.services();
    }

    public record ExceptionRequest(String type, String description) {
    }

    @PostMapping("/{id}/exceptions")
    public Garment report(@PathVariable Long id, @RequestBody ExceptionRequest request) {
        return service.reportException(id, request.type(), request.description());
    }

    @PostMapping
    public Garment tag(@RequestBody Garment g) {
        return service.tagGarment(g);
    }

    @GetMapping
    public List<Garment> getAll() {
        return service.getAllGarments();
    }

    @GetMapping("/{id}")
    public Garment get(@PathVariable Long id) {
        return service.getGarment(id);
    }

    @GetMapping("/order/{orderId}")
    public List<Garment> getByOrder(@PathVariable Long orderId) {
        return service.getGarmentsByOrder(orderId);
    }

    @PutMapping("/{id}")
    public Garment update(@PathVariable Long id, @RequestBody Garment g) {
        return service.updateGarment(id, g);
    }

    @PutMapping("/{id}/damage")
    public Garment flagDamage(@PathVariable Long id, @RequestParam boolean isDamaged) {
        return service.flagDamage(id, isDamaged);
    }

    @DeleteMapping("/{id}")
    public void remove(@PathVariable Long id) {
        service.removeGarment(id);
    }
}
