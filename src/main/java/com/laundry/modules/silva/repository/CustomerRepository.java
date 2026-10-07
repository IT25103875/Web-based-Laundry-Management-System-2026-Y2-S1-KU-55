package com.laundry.modules.silva.repository;

import com.laundry.modules.silva.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    List<Customer> findByIsActiveTrue();

    Optional<Customer> findByEmail(String email);
}
