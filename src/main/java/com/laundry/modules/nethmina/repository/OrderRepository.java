package com.laundry.modules.nethmina.repository;

import com.laundry.modules.nethmina.model.LaundryOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRepository extends JpaRepository<LaundryOrder, Long> {
    List<LaundryOrder> findByIsActiveTrue();

    List<LaundryOrder> findByCustomerIdAndIsActiveTrue(Long customerId);
}
