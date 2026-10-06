package com.laundry.modules.marasinghe.repository;

import com.laundry.modules.marasinghe.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> findByIsActiveTrue();
}
