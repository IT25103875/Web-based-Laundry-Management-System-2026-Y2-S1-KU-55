package com.laundry.modules.nethmina.controller;

import com.laundry.modules.nethmina.model.LaundryOrder;
import com.laundry.modules.nethmina.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "http://localhost:5173")
public class OrderController {
    @Autowired
    private OrderService service;

    public record BookingRequest(LaundryOrder order, com.laundry.modules.dasanayaka.model.Garment garment,
                                 com.laundry.modules.naveeth.model.DeliverySchedule delivery) {}
    @PostMapping("/booking")
    public LaundryOrder book(@RequestBody BookingRequest request) {
        if (request.order() == null || request.garment() == null || request.delivery() == null)
            throw new IllegalArgumentException("Order, garment and delivery details are required");
        return service.book(request.order(), request.garment(), request.delivery());
    }

    @PostMapping
    public LaundryOrder create(@RequestBody LaundryOrder o) {
        return service.createOrder(o);
    }

    @GetMapping
    public List<LaundryOrder> getAll() {
        return service.getOrders();
    }

    @GetMapping("/customer/{customerId}")
    public List<LaundryOrder> getByCustomer(@PathVariable Long customerId) {
        return service.getOrdersByCustomer(customerId);
    }

    @GetMapping("/{id}")
    public LaundryOrder get(@PathVariable Long id) {
        return service.getOrder(id);
    }

    @PutMapping("/{id}")
    public LaundryOrder update(@PathVariable Long id, @RequestBody LaundryOrder o) {
        return service.updateOrder(id, o);
    }

    @PutMapping("/{id}/status")
    public LaundryOrder updateStatus(@PathVariable Long id, @RequestBody String status) {
        return service.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public void cancel(@PathVariable Long id) {
        service.cancelOrder(id);
    }
}
