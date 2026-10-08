package com.laundry.modules.naveeth.controller;

import com.laundry.modules.naveeth.model.DeliverySchedule;
import com.laundry.modules.naveeth.service.DeliveryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/deliveries")
@CrossOrigin(origins = "http://localhost:5173")
public class DeliveryController {
    @Autowired
    private DeliveryService service;

    @GetMapping("/drivers")
    public java.util.List<java.util.Map<String, Object>> drivers() { return service.drivers(); }

    @GetMapping("/{id}/history")
    public java.util.Map<String,Object> history(@PathVariable Long id) { return service.detail(id); }
    public record IncidentRequest(String description) {}
    @PostMapping("/{id}/incidents")
    public void incident(@PathVariable Long id,@RequestBody IncidentRequest request) { service.reportIncident(id,request.description()); }
    @PutMapping("/{id}/incidents/{incidentId}/resolve")
    public void resolve(@PathVariable Long id,@PathVariable Long incidentId) { service.resolveIncident(id,incidentId); }

    @PostMapping
    public DeliverySchedule schedule(@RequestBody DeliverySchedule s) {
        return service.schedule(s);
    }

    @GetMapping
    public List<DeliverySchedule> getAll() {
        return service.getAllSchedules();
    }

    @GetMapping("/order/{orderId}")
    public List<DeliverySchedule> getByOrder(@PathVariable Long orderId) {
        return service.getSchedulesByOrder(orderId);
    }

    @GetMapping("/{id}")
    public DeliverySchedule get(@PathVariable Long id) {
        return service.getSchedule(id);
    }

    @PutMapping("/{id}")
    public DeliverySchedule update(@PathVariable Long id, @RequestBody DeliverySchedule s) {
        return service.updateSchedule(id, s);
    }

    @PutMapping("/{id}/status")
    public DeliverySchedule updateStatus(@PathVariable Long id, @RequestBody String status) {
        return service.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public void cancel(@PathVariable Long id) {
        service.cancelSchedule(id);
    }
}
