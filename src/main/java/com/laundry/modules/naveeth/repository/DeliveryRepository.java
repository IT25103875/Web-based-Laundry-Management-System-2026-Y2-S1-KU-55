package com.laundry.modules.naveeth.repository;

import com.laundry.modules.naveeth.model.DeliverySchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DeliveryRepository extends JpaRepository<DeliverySchedule, Long> {
    List<DeliverySchedule> findByOrderId(Long orderId);
}
