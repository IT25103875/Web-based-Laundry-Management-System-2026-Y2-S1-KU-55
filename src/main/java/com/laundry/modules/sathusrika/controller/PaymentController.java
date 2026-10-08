package com.laundry.modules.sathusrika.controller;

import com.laundry.modules.sathusrika.model.Invoice;
import com.laundry.modules.sathusrika.service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "http://localhost:5173")
public class PaymentController {
    @Autowired
    private PaymentService service;

    @GetMapping("/refunds")
    public java.util.List<java.util.Map<String,Object>> refunds() { return service.refunds(); }
    @PutMapping("/refunds/{id}/decision")
    public void decide(@PathVariable Long id,@RequestBody String status) { service.decideRefund(id,status); }

    @GetMapping("/summary")
    public java.util.Map<String,java.math.BigDecimal> summary() { return service.summary(); }

    @PostMapping
    public Invoice generate(@RequestBody Invoice i) {
        return service.generateInvoice(i);
    }

    @GetMapping
    public List<Invoice> getAll() {
        return service.getAllInvoices();
    }

    @GetMapping("/order/{orderId}")
    public List<Invoice> getByOrder(@PathVariable Long orderId) {
        return service.getInvoicesByOrder(orderId);
    }

    @GetMapping("/{id}")
    public Invoice get(@PathVariable Long id) {
        return service.getInvoice(id);
    }

    @PutMapping("/{id}")
    public Invoice update(@PathVariable Long id, @RequestBody Invoice i) {
        return service.updateInvoice(id, i);
    }

    @PutMapping("/{id}/pay")
    public Invoice pay(@PathVariable Long id) {
        return service.processPayment(id);
    }

    @PutMapping("/{id}/refund")
    public Invoice refund(@PathVariable Long id, @RequestBody String status) {
        return service.voidOrRefund(id, status);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.deleteInvoice(id);
    }
}
