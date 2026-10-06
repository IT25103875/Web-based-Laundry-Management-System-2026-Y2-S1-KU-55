package com.laundry.modules.marasinghe.controller;

import com.laundry.modules.marasinghe.model.Employee;
import com.laundry.modules.marasinghe.service.StaffService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/staff")
@CrossOrigin(origins = "http://localhost:5173")
public class StaffController {
    @Autowired
    private StaffService service;

    @GetMapping("/{id}/shifts")
    public java.util.List<java.util.Map<String,Object>> shifts(@PathVariable Long id) { return service.shifts(id); }

    @GetMapping("/{id}/audit")
    public java.util.List<java.util.Map<String,Object>> audit(@PathVariable Long id) { return service.audit(id); }

    @PostMapping
    public Employee onboardEmployee(@RequestBody Employee e) {
        return service.createEmployee(e);
    }

    @GetMapping
    public List<Employee> getInternalDirectory() {
        return service.getAllActiveEmployees();
    }

    @GetMapping("/{id}")
    public Employee getEmployee(@PathVariable Long id) {
        return service.getEmployee(id);
    }

    @PutMapping("/{id}")
    public Employee modifyEmployee(@PathVariable Long id, @RequestBody Employee e) {
        return service.updateEmployee(id, e);
    }

    @DeleteMapping("/{id}")
    public void revokeAccess(@PathVariable Long id) {
        service.revokeAccess(id);
    }
}
