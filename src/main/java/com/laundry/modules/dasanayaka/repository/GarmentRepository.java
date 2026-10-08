package com.laundry.modules.dasanayaka.repository;

import com.laundry.modules.dasanayaka.model.Garment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GarmentRepository extends JpaRepository<Garment, Long> {
    List<Garment> findByOrderId(Long orderId);
}
