package com.laundry.modules.marasinghe.controller;

import com.laundry.modules.dasanayaka.model.Garment;
import com.laundry.modules.dasanayaka.service.GarmentService;
import com.laundry.modules.marasinghe.model.Employee;
import com.laundry.modules.marasinghe.service.StaffService;
import com.laundry.modules.naveeth.model.DeliverySchedule;
import com.laundry.modules.naveeth.service.DeliveryService;
import com.laundry.modules.nethmina.model.LaundryOrder;
import com.laundry.modules.nethmina.service.OrderService;
import com.laundry.modules.sathusrika.model.Invoice;
import com.laundry.modules.sathusrika.service.PaymentService;
import com.laundry.modules.silva.model.Customer;
import com.laundry.modules.silva.service.CustomerService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;
import java.util.Locale;

@Controller
public class LaundryManagementController {
    private final CustomerService customers;
    private final OrderService orders;
    private final GarmentService garments;
    private final PaymentService payments;
    private final DeliveryService deliveries;
    private final StaffService staff;

    public LaundryManagementController(CustomerService customers, OrderService orders, GarmentService garments,
            PaymentService payments, DeliveryService deliveries, StaffService staff) {
        this.customers = customers;
        this.orders = orders;
        this.garments = garments;
        this.payments = payments;
        this.deliveries = deliveries;
        this.staff = staff;
    }

    @GetMapping("/login")
    public String login(Model model, org.springframework.security.core.Authentication authentication) {
        model.addAttribute("mustChangePassword", authentication != null && authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_PASSWORD_CHANGE_REQUIRED")));
        return "login";
    }
    @ModelAttribute("authorities")
    public List<String> authorities(org.springframework.security.core.Authentication authentication) {
        return authentication == null ? List.of() : authentication.getAuthorities().stream().map(a -> a.getAuthority()).toList();
    }
    @PostMapping("/password")
    public String changePassword(@RequestParam String password, org.springframework.security.core.Authentication authentication,
                                jakarta.servlet.http.HttpServletRequest request, RedirectAttributes attributes) {
        try {
            com.laundry.config.DBConnection.text(password,"New password",8,72);
            try (var c=com.laundry.config.DBConnection.getConnection(); var find=c.prepareStatement("SELECT user_id,password_hash FROM users WHERE email=? AND status='ACTIVE'")) {
                find.setString(1,authentication.getName());
                try (var row=find.executeQuery()) {
                    if (!row.next()) throw new IllegalArgumentException("Registered account required");
                    if (com.laundry.config.PasswordUtil.matches(password,row.getString(2))) throw new IllegalArgumentException("Choose a different new password");
                    try (var statement=c.prepareCall("{CALL sp_change_password(?,?)}")) { statement.setLong(1,row.getLong(1)); statement.setString(2,com.laundry.config.PasswordUtil.hash(password)); statement.execute(); }
                }
            }
            if(request.getSession(false)!=null) request.getSession(false).invalidate();
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
            attributes.addFlashAttribute("success","Password changed. Sign in using your new password.");
        } catch (java.sql.SQLException ex) { attributes.addFlashAttribute("error","Could not change password. Try again."); }
          catch (IllegalArgumentException ex) { attributes.addFlashAttribute("error",ex.getMessage()); }
        return "redirect:/login";
    }

    @GetMapping({ "/", "/dashboard" })
    public String dashboard(Model model) {
        List<Customer> customerList = customers.getActiveCustomers();
        List<LaundryOrder> orderList = orders.getOrders();
        List<Garment> garmentList = garments.getAllGarments();
        List<Invoice> invoiceList = payments.getAllInvoices();
        List<DeliverySchedule> deliveryList = deliveries.getAllSchedules();
        List<Employee> employeeList = staff.getAllActiveEmployees();

        model.addAttribute("page", "dashboard");
        model.addAttribute("customersCount", customerList.size());
        model.addAttribute("ordersCount", orderList.size());
        model.addAttribute("garmentsCount", garmentList.size());
        model.addAttribute("paymentsCount", invoiceList.size());
        model.addAttribute("deliveriesCount", deliveryList.size());
        model.addAttribute("staffCount", employeeList.size());
        model.addAttribute("orders", orderList);
        model.addAttribute("payments", invoiceList);
        model.addAttribute("deliveries", deliveryList);
        return "admin";
    }

    @GetMapping("/customers")
    public String customers(Model model, @RequestParam(defaultValue = "") String q) {
        List<Customer> list = filter(customers.getActiveCustomers(), q,
                c -> c.getFullName() + " " + c.getEmail() + " " + c.getPhone() + " " + c.getAddress());
        model.addAttribute("page", "customers");
        model.addAttribute("customers", list);
        model.addAttribute("customerForm", new Customer());
        model.addAttribute("q", q);
        return "admin";
    }

    @PostMapping("/customers")
    public String saveCustomer(@ModelAttribute Customer customer, RedirectAttributes redirectAttributes) {
        try {
            if (customer.getId() == null) {
                customers.registerCustomer(customer);
            } else {
                customers.updateCustomer(customer.getId(), customer);
            }
            redirectAttributes.addFlashAttribute("success", "Customer saved successfully.");
        } catch (RuntimeException ex) {
            redirectAttributes.addFlashAttribute("error", ex instanceof IllegalArgumentException ? ex.getMessage() : "Customer could not be saved.");
        }
        return "redirect:/customers";
    }

    @PostMapping("/customers/{id}/delete")
    public String deleteCustomer(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        return handle(() -> customers.archiveCustomer(id), "Customer archived.", "Customer could not be archived.",
                "/customers", redirectAttributes);
    }

    @GetMapping("/orders")
    public String orders(Model model, @RequestParam(defaultValue = "") String q) {
        model.addAttribute("page", "orders");
        model.addAttribute("orders", filter(orders.getOrders(), q,
                o -> o.getId() + " " + o.getCustomerId() + " " + o.getServiceType() + " " + o.getStatus()));
        model.addAttribute("orderForm", new LaundryOrder());
        model.addAttribute("q", q);
        return "admin";
    }

    @PostMapping("/orders")
    public String saveOrder(@ModelAttribute LaundryOrder order, RedirectAttributes redirectAttributes) {
        try {
            if (order.getId() == null) {
                orders.createOrder(order);
            } else {
                orders.updateOrder(order.getId(), order);
            }
            redirectAttributes.addFlashAttribute("success", "Order saved successfully.");
        } catch (RuntimeException ex) {
            redirectAttributes.addFlashAttribute("error", ex instanceof IllegalArgumentException ? ex.getMessage() : "Order could not be saved.");
        }
        return "redirect:/orders";
    }

    @PostMapping("/orders/{id}/status")
    public String updateOrderStatus(@PathVariable Long id, @RequestParam String status,
            RedirectAttributes redirectAttributes) {
        return handle(() -> orders.updateStatus(id, status), "Order status updated.",
                "Order status could not be updated.", "/orders", redirectAttributes);
    }

    @PostMapping("/orders/{id}/delete")
    public String deleteOrder(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        return handle(() -> orders.cancelOrder(id), "Order cancelled.", "Order could not be cancelled.", "/orders",
                redirectAttributes);
    }

    @GetMapping("/garments")
    public String garments(Model model, @RequestParam(defaultValue = "") String q) {
        model.addAttribute("page", "garments");
        model.addAttribute("garments", filter(garments.getAllGarments(), q,
                g -> g.getId() + " " + g.getOrderId() + " " + g.getFabricType() + " " + g.getCareInstructions()));
        model.addAttribute("garmentForm", new Garment());
        model.addAttribute("services", garments.services());
        model.addAttribute("q", q);
        return "admin";
    }

    @PostMapping("/garments")
    public String saveGarment(@ModelAttribute Garment garment, RedirectAttributes redirectAttributes) {
        try {
            if (garment.getId() == null) {
                garments.tagGarment(garment);
            } else {
                garments.updateGarment(garment.getId(), garment);
            }
            redirectAttributes.addFlashAttribute("success", "Garment saved successfully.");
        } catch (RuntimeException ex) {
            redirectAttributes.addFlashAttribute("error", ex instanceof IllegalArgumentException ? ex.getMessage() : "Garment could not be saved.");
        }
        return "redirect:/garments";
    }

    @PostMapping("/garments/{id}/delete")
    public String deleteGarment(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        return handle(() -> garments.removeGarment(id), "Garment removed.", "Garment could not be removed.",
                "/garments", redirectAttributes);
    }

    @GetMapping("/payments")
    public String payments(Model model, @RequestParam(defaultValue = "") String q) {
        model.addAttribute("page", "payments");
        model.addAttribute("payments", filter(payments.getAllInvoices(), q,
                p -> p.getId() + " " + p.getOrderId() + " " + p.getAmount() + " " + p.getStatus()));
        model.addAttribute("paymentForm", new Invoice());
        model.addAttribute("q", q);
        return "admin";
    }

    @PostMapping("/payments")
    public String savePayment(@ModelAttribute Invoice invoice, RedirectAttributes redirectAttributes) {
        return handle(() -> payments.generateInvoice(invoice), "Invoice generated.", "Invoice could not be generated.",
                "/payments", redirectAttributes);
    }

    @PostMapping("/payments/{id}/pay")
    public String pay(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        return handle(() -> payments.processPayment(id), "Payment marked as paid.", "Payment could not be processed.",
                "/payments", redirectAttributes);
    }

    @PostMapping("/payments/{id}/refund")
    public String refund(@PathVariable Long id, @RequestParam String status, RedirectAttributes redirectAttributes) {
        return handle(() -> payments.voidOrRefund(id, status), "Payment status updated.",
                "Payment status could not be updated.", "/payments", redirectAttributes);
    }

    @GetMapping("/deliveries")
    public String deliveries(Model model, @RequestParam(defaultValue = "") String q) {
        model.addAttribute("page", "deliveries");
        model.addAttribute("deliveries", filter(deliveries.getAllSchedules(), q, d -> d.getId() + " " + d.getOrderId()
                + " " + d.getDriverName() + " " + d.getTimeSlot() + " " + d.getStatus()));
        model.addAttribute("deliveryForm", new DeliverySchedule());
        model.addAttribute("drivers", deliveries.drivers());
        model.addAttribute("q", q);
        return "admin";
    }

    @PostMapping("/deliveries")
    public String saveDelivery(@ModelAttribute DeliverySchedule delivery, RedirectAttributes redirectAttributes) {
        return handle(() -> deliveries.schedule(delivery), "Delivery saved.", "Delivery could not be saved.",
                "/deliveries", redirectAttributes);
    }

    @PostMapping("/deliveries/{id}/status")
    public String updateDeliveryStatus(@PathVariable Long id, @RequestParam String status,
            RedirectAttributes redirectAttributes) {
        return handle(() -> deliveries.updateStatus(id, status), "Delivery status updated.",
                "Delivery status could not be updated.", "/deliveries", redirectAttributes);
    }

    @PostMapping("/deliveries/{id}/delete")
    public String deleteDelivery(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        return handle(() -> deliveries.cancelSchedule(id), "Delivery cancelled.", "Delivery could not be cancelled.",
                "/deliveries", redirectAttributes);
    }

    @GetMapping("/staff")
    public String staff(Model model, @RequestParam(defaultValue = "") String q) {
        model.addAttribute("page", "staff");
        model.addAttribute("staff", filter(staff.getAllActiveEmployees(), q, s -> s.getId() + " " + s.getFullName()
                + " " + s.getEmail() + " " + s.getSystemRole() + " " + s.getShiftTiming()));
        model.addAttribute("staffForm", new Employee());
        model.addAttribute("q", q);
        return "admin";
    }

    @PostMapping("/staff")
    public String saveStaff(@ModelAttribute Employee employee, RedirectAttributes redirectAttributes) {
        try {
            if (employee.getId() == null) {
                staff.createEmployee(employee);
            } else {
                staff.updateEmployee(employee.getId(), employee);
            }
            redirectAttributes.addFlashAttribute("success", "Staff record saved.");
        } catch (RuntimeException ex) {
            redirectAttributes.addFlashAttribute("error", ex instanceof IllegalArgumentException ? ex.getMessage() : "Staff record could not be saved.");
        }
        return "redirect:/staff";
    }

    @PostMapping("/staff/{id}/delete")
    public String deleteStaff(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        return handle(() -> staff.revokeAccess(id), "Staff member deactivated.",
                "Staff member could not be deactivated.", "/staff", redirectAttributes);
    }

    private String handle(Runnable action, String success, String error, String redirect,
            RedirectAttributes redirectAttributes) {
        try {
            action.run();
            redirectAttributes.addFlashAttribute("success", success);
        } catch (RuntimeException ex) {
            redirectAttributes.addFlashAttribute("error", ex instanceof IllegalArgumentException ? ex.getMessage() : error);
        }
        return "redirect:" + redirect;
    }

    private <T> List<T> filter(List<T> items, String q, TextExtractor<T> extractor) {
        if (q == null || q.isBlank()) {
            return items;
        }
        String needle = q.toLowerCase(Locale.ROOT);
        return items.stream()
                .filter(item -> extractor.text(item).toLowerCase(Locale.ROOT).contains(needle))
                .toList();
    }

    private interface TextExtractor<T> {
        String text(T item);
    }
}
