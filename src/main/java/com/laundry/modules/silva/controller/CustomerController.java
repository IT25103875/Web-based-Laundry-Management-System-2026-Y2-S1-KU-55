package com.laundry.modules.silva.controller;

import com.laundry.modules.silva.model.Customer;
import com.laundry.modules.silva.service.CustomerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "http://localhost:5173")
public class CustomerController {
    @Autowired
    private CustomerService service;

    @GetMapping("/me/notifications")
    public java.util.List<java.util.Map<String,Object>> notifications(Principal principal) { return service.notifications(principal.getName()); }

    @PostMapping
    public Customer register(@RequestBody Customer c) {
        return service.registerCustomer(c);
    }

    @GetMapping
    public List<Customer> getAllActive() {
        return service.getActiveCustomers();
    }

    @GetMapping("/me")
    public Customer me(Principal principal) {
        return service.getCustomerByEmail(principal.getName());
    }

    @PutMapping("/me")
    public Customer updateMe(Principal principal, @RequestBody Customer c) {
        return service.updateCustomerByEmail(principal.getName(), c);
    }

    @GetMapping("/{id}")
    public Customer get(@PathVariable Long id) {
        return service.getCustomer(id);
    }

    @PutMapping("/{id}")
    public Customer update(@PathVariable Long id, @RequestBody Customer c) {
        return service.updateCustomer(id, c);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable Long id) {
        service.archiveCustomer(id);
    }
}
