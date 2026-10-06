-- =====================================================================
--  Clean Cloud Laundry Management System  -  DATABASE  (version 3)
--  Database name : CleanCloudDB_New
--  Target        : MySQL 8.0.16 or newer (CHECK constraints are enforced)
--  Modules       : IT2140 (Database Design)  +  SE2030 (Java web app)
--  Group         : 2026-Y2-S1-KU-55
--
--  WHAT CHANGED IN VERSION 3 (gaps found while testing v2 against the
--  Design Document, the use case scenarios and the activity diagrams)
--   1. users.must_change_password  - SM01 requires a temporary password and a
--      mandatory password change at first login. Set by sp_onboard_staff,
--      cleared by the new sp_change_password.
--   2. AUDIT TRAIL IS NOW WRITTEN (FR-24). v2 created the audit_log table but
--      nothing ever inserted into it. Triggers now record: staff onboarding,
--      role assignment and revocation, access revocation/restoration, order
--      cancellation, invoice void and every refund decision.
--   3. DRIVER DOUBLE-BOOKING IS NOW BLOCKED (FR-15, DM01/DM04). v2 allowed the
--      same driver to hold two deliveries in the same date and time slot.
--   4. GARMENT STATUS FOLLOWS THE ORDER (FR-04, FR-08, S9). Garments stayed on
--      RECEIVED for ever in v2; they now move with their order.
--   5. A FAILED DELIVERY UPDATES THE ORDER (FR-15/FR-17, DM03): an order that
--      was OUT_FOR_DELIVERY returns to READY_FOR_COLLECTION for rescheduling.
--   6. sp_record_payment   - idempotent payment recording (PM02/PM03, FR-13):
--      a repeated gateway reference returns the existing result, it does not
--      charge again.
--   7. sp_generate_invoice - clear error instead of a raw duplicate-key error
--      when an order already has an active invoice.
--   8. sp_customer_order_history - customers read their own records only (FR-02).
--   9. sp_notification_result - notification retry with a staff alert when the
--      retries are exhausted (FR-23, FR-18).
--  10. v_driver_workload  - driver availability for the dispatch board (FR-15).
--
--  SESSION VARIABLE
--   SET @app_user_id = <signed-in user_id>;  at the start of every request.
--   The audit trail and the delivery status history record that user. When it
--   is not set the database falls back to the owner of the record, so nothing
--   breaks while testing from a SQL client.
--
--  SAFETY
--   * Creates its own database. Your existing CleanCloudDB is not touched.
--   * No DROP TABLE, no DROP DATABASE, no DELETE, no TRUNCATE anywhere.
--   * The only DROP statements are "DROP TRIGGER/PROCEDURE IF EXISTS" for
--     the routines defined in THIS file, so the script can be re-run.
--   * Every table is CREATE TABLE IF NOT EXISTS, seed data is INSERT IGNORE.
--
--  CONTENTS
--   19 tables  : the 16 EER entities
--                + staff_role              (M:N junction, AssignedRole)
--                + customer_contact_number (multivalued contact_numbers)
--                + shift                   (FR-15, FR-20, FR-22)
--   15 views   : derived attribute, dashboards, S4 reports, integrity check
--   triggers   : business rules enforced INSIDE the database
--   5 procedures for the multi-table operations (register customer,
--                onboard staff, generate invoice, cancel order, summary)
--
--  DIFFERENCES FROM THE SUBMITTED EER (update them in EER v2)
--   1. Weak entities (Garment, DeliveryStatusHistory): surrogate id +
--      NOT NULL owner FK + ON DELETE CASCADE + UNIQUE(owner, partial key).
--   2. HasException is 1:N (a garment can have several exceptions).
--   3. GeneratesInvoice is 1:N with at most ONE non-void invoice per
--      order, so a duplicate invoice can be voided (FR-14).
--   4. Staff key is user_id (inherited via ISA); employee_no is UNIQUE.
--   5. staff_role keeps history; only ONE ACTIVE role per staff (FR-19).
--   6. delivery_incident.reported_by references users (customer or staff).
--   7. Extra columns from the interviews: garment_type, unit_price,
--      cancelled_at, cancel_reason, retry_count, salary, address,
--      emergency contact, department, created_by_staff_id.
--
--  OPTIONAL SESSION VARIABLE
--   SET @app_user_id = <staff user_id>;  before an UPDATE lets the
--   delivery status history record who made the change.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS CleanCloudDB_New
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE CleanCloudDB_New;

-- =====================================================================
-- PART 1 : TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- USERS  (ISA supertype).  FR-01, FR-19, NFR-03.
-- Contact number is the primary identifier (S1); email is optional.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id        BIGINT       NOT NULL AUTO_INCREMENT,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NULL,
    phone          VARCHAR(20)  NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    must_change_password TINYINT    NOT NULL DEFAULT 0,
    user_type      VARCHAR(10)  NOT NULL,
    status         VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_id_type UNIQUE (user_id, user_type),
    CONSTRAINT ck_users_type   CHECK (user_type IN ('CUSTOMER','STAFF')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
    CONSTRAINT ck_users_phone  CHECK (phone REGEXP '^[+]?[0-9]{9,15}$'),
    CONSTRAINT ck_users_email  CHECK (email IS NULL OR email LIKE '%_@_%._%'),
    CONSTRAINT ck_users_name   CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2),
    CONSTRAINT ck_users_hash   CHECK (CHAR_LENGTH(password_hash) >= 20),
    CONSTRAINT ck_users_mcp    CHECK (must_change_password IN (0,1))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- CUSTOMER (ISA subtype).  The (user_id, user_type) foreign key plus the
-- CHECK guarantees a customer row can only point at a CUSTOMER user.
-- address is composite in the EER: street, city, postal_code.
-- "Delete" = users.status ARCHIVED; history is retained.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer (
    user_id           BIGINT       NOT NULL,
    user_type         VARCHAR(10)  NOT NULL DEFAULT 'CUSTOMER',
    street            VARCHAR(150) NOT NULL,
    city              VARCHAR(80)  NOT NULL,
    postal_code       VARCHAR(10)  NULL,
    registration_date DATE         NOT NULL DEFAULT (CURRENT_DATE),
    customer_notes    TEXT         NULL,
    CONSTRAINT pk_customer PRIMARY KEY (user_id),
    CONSTRAINT fk_customer_user FOREIGN KEY (user_id, user_type)
        REFERENCES users (user_id, user_type),
    CONSTRAINT ck_customer_type CHECK (user_type = 'CUSTOMER'),
    CONSTRAINT ck_customer_street CHECK (CHAR_LENGTH(TRIM(street)) > 0),
    CONSTRAINT ck_customer_city CHECK (CHAR_LENGTH(TRIM(city)) > 0)
) ENGINE=InnoDB;

-- Multivalued attribute contact_numbers (extra numbers besides users.phone)
CREATE TABLE IF NOT EXISTS customer_contact_number (
    contact_id     BIGINT      NOT NULL AUTO_INCREMENT,
    customer_id    BIGINT      NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    CONSTRAINT pk_customer_contact PRIMARY KEY (contact_id),
    CONSTRAINT uq_customer_contact UNIQUE (customer_id, contact_number),
    CONSTRAINT fk_contact_customer FOREIGN KEY (customer_id)
        REFERENCES customer (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_contact_number CHECK (contact_number REGEXP '^[+]?[0-9]{9,15}$')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- STAFF (ISA subtype) with the recursive relationship Supervises.
-- S6: employee ID, contact, address, position, joining date, salary,
-- work status, branch/department, emergency contact.
-- "Delete" = work_status INACTIVE (access revoked, record kept).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
    user_id                  BIGINT        NOT NULL,
    user_type                VARCHAR(10)   NOT NULL DEFAULT 'STAFF',
    employee_no              VARCHAR(20)   NOT NULL,
    address                  VARCHAR(255)  NULL,
    job_position             VARCHAR(50)   NOT NULL,
    date_of_joining          DATE          NOT NULL,
    salary                   DECIMAL(12,2) NULL,
    work_status              VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    branch                   VARCHAR(60)   NOT NULL DEFAULT 'Main Branch',
    department               VARCHAR(60)   NULL,
    emergency_contact_name   VARCHAR(100)  NULL,
    emergency_contact_phone  VARCHAR(20)   NULL,
    supervisor_id            BIGINT        NULL,
    CONSTRAINT pk_staff PRIMARY KEY (user_id),
    CONSTRAINT uq_staff_employee_no UNIQUE (employee_no),
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id, user_type)
        REFERENCES users (user_id, user_type),
    CONSTRAINT fk_staff_supervisor FOREIGN KEY (supervisor_id)
        REFERENCES staff (user_id),
    CONSTRAINT ck_staff_type   CHECK (user_type = 'STAFF'),
    CONSTRAINT ck_staff_status CHECK (work_status IN ('ACTIVE','INACTIVE')),
    CONSTRAINT ck_staff_salary CHECK (salary IS NULL OR salary >= 0),
    CONSTRAINT ck_staff_not_own_boss CHECK (supervisor_id IS NULL OR supervisor_id <> user_id),
    CONSTRAINT ck_staff_position CHECK (CHAR_LENGTH(TRIM(job_position)) > 0),
    CONSTRAINT ck_staff_emerg_phone CHECK
        (emergency_contact_phone IS NULL OR emergency_contact_phone REGEXP '^[+]?[0-9]{9,15}$')
) ENGINE=InnoDB;

-- ROLE : RBAC roles named by the business owner (S3, S12)
CREATE TABLE IF NOT EXISTS role (
    role_id     INT          NOT NULL AUTO_INCREMENT,
    role_name   VARCHAR(40)  NOT NULL,
    description VARCHAR(255) NULL,
    CONSTRAINT pk_role PRIMARY KEY (role_id),
    CONSTRAINT uq_role_name UNIQUE (role_name)
) ENGINE=InnoDB;

-- AssignedRole (M:N Staff - Role) with its own attributes.
-- active_staff_key is NULL unless the row is ACTIVE. The UNIQUE index on
-- it allows only one ACTIVE role per staff member (FR-19) while older
-- roles stay as history.
CREATE TABLE IF NOT EXISTS staff_role (
    staff_role_id    BIGINT      NOT NULL AUTO_INCREMENT,
    staff_id         BIGINT      NOT NULL,
    role_id          INT         NOT NULL,
    assigned_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status           VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    active_staff_key BIGINT GENERATED ALWAYS AS
        (CASE WHEN status = 'ACTIVE' THEN staff_id ELSE NULL END) VIRTUAL,
    CONSTRAINT pk_staff_role PRIMARY KEY (staff_role_id),
    CONSTRAINT uq_one_active_role UNIQUE (active_staff_key),
    CONSTRAINT fk_staff_role_staff FOREIGN KEY (staff_id) REFERENCES staff (user_id),
    CONSTRAINT fk_staff_role_role  FOREIGN KEY (role_id)  REFERENCES role (role_id),
    CONSTRAINT ck_staff_role_status CHECK (status IN ('ACTIVE','REVOKED'))
) ENGINE=InnoDB;

-- SHIFT : schedules, shift timing and duties (FR-20, FR-22); also lets
-- FR-15 check driver availability.
CREATE TABLE IF NOT EXISTS shift (
    shift_id    BIGINT       NOT NULL AUTO_INCREMENT,
    staff_id    BIGINT       NOT NULL,
    shift_date  DATE         NOT NULL,
    start_time  TIME         NOT NULL,
    end_time    TIME         NOT NULL,
    duty        VARCHAR(100) NULL,
    CONSTRAINT pk_shift PRIMARY KEY (shift_id),
    CONSTRAINT uq_shift_slot UNIQUE (staff_id, shift_date, start_time),
    CONSTRAINT fk_shift_staff FOREIGN KEY (staff_id) REFERENCES staff (user_id),
    CONSTRAINT ck_shift_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- LAUNDRY_SERVICE (S5)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS laundry_service (
    service_id                 INT           NOT NULL AUTO_INCREMENT,
    service_name               VARCHAR(60)   NOT NULL,
    description                VARCHAR(255)  NULL,
    price                      DECIMAL(10,2) NOT NULL,
    estimated_completion_hours INT           NOT NULL,
    availability_status        VARCHAR(12)   NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT pk_laundry_service PRIMARY KEY (service_id),
    CONSTRAINT uq_service_name UNIQUE (service_name),
    CONSTRAINT ck_service_price CHECK (price >= 0),
    CONSTRAINT ck_service_hours CHECK (estimated_completion_hours > 0),
    CONSTRAINT ck_service_avail CHECK (availability_status IN ('AVAILABLE','UNAVAILABLE'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- ORDERS ("order" is a reserved SQL word).  FR-03..07, S10, S13.
-- estimated_charge is derived: see view v_order_estimated_charge.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    order_id                 BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id              BIGINT       NOT NULL,
    created_by_staff_id      BIGINT       NULL,
    order_date               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_completion_date DATE         NOT NULL,
    delivery_preference      VARCHAR(12)  NOT NULL DEFAULT 'COLLECTION',
    status                   VARCHAR(25)  NOT NULL DEFAULT 'RECEIVED',
    special_instructions     TEXT         NULL,
    cancelled_at             DATETIME     NULL,
    cancel_reason            VARCHAR(255) NULL,
    CONSTRAINT pk_orders PRIMARY KEY (order_id),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customer (user_id),
    CONSTRAINT fk_orders_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff (user_id),
    CONSTRAINT ck_orders_pref CHECK (delivery_preference IN ('COLLECTION','DELIVERY')),
    CONSTRAINT ck_orders_status CHECK (status IN
        ('RECEIVED','IN_WASHING','IN_DRY_CLEANING','IN_IRONING','QUALITY_CHECKED',
         'READY_FOR_COLLECTION','OUT_FOR_DELIVERY','COMPLETED','CANCELLED')),
    CONSTRAINT ck_orders_dates CHECK (DATE(order_date) <= expected_completion_date),
    CONSTRAINT ck_orders_cancel CHECK (status <> 'CANCELLED' OR cancelled_at IS NOT NULL),
    INDEX idx_orders_status (status),
    INDEX idx_orders_date (order_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- GARMENT (weak entity, owner = orders). garment_no is the partial key
-- (1, 2, 3 ... inside one order). Filled automatically when omitted.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS garment (
    garment_id        BIGINT        NOT NULL AUTO_INCREMENT,
    order_id          BIGINT        NOT NULL,
    garment_no        INT           NOT NULL,
    service_id        INT           NOT NULL,
    garment_type      VARCHAR(50)   NOT NULL,
    fabric_type       VARCHAR(50)   NULL,
    quantity          INT           NOT NULL DEFAULT 1,
    unit_price        DECIMAL(10,2) NOT NULL,
    care_instructions TEXT          NULL,
    status            VARCHAR(25)   NOT NULL DEFAULT 'RECEIVED',
    CONSTRAINT pk_garment PRIMARY KEY (garment_id),
    CONSTRAINT uq_garment_in_order UNIQUE (order_id, garment_no),
    CONSTRAINT fk_garment_order FOREIGN KEY (order_id)
        REFERENCES orders (order_id) ON DELETE CASCADE,
    CONSTRAINT fk_garment_service FOREIGN KEY (service_id)
        REFERENCES laundry_service (service_id),
    CONSTRAINT ck_garment_qty CHECK (quantity > 0),
    CONSTRAINT ck_garment_price CHECK (unit_price >= 0),
    CONSTRAINT ck_garment_type CHECK (CHAR_LENGTH(TRIM(garment_type)) > 0),
    CONSTRAINT ck_garment_status CHECK (status IN
        ('RECEIVED','IN_WASHING','IN_DRY_CLEANING','IN_IRONING','QUALITY_CHECKED',
         'READY_FOR_COLLECTION','OUT_FOR_DELIVERY','COMPLETED'))
) ENGINE=InnoDB;

-- GARMENT_EXCEPTION : damaged / missing item flagged by staff (FR-09)
CREATE TABLE IF NOT EXISTS garment_exception (
    exception_id        BIGINT      NOT NULL AUTO_INCREMENT,
    garment_id          BIGINT      NOT NULL,
    exception_type      VARCHAR(10) NOT NULL,
    description         TEXT        NULL,
    flagged_by          BIGINT      NOT NULL,
    flagged_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notification_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT pk_garment_exception PRIMARY KEY (exception_id),
    CONSTRAINT fk_gexc_garment FOREIGN KEY (garment_id)
        REFERENCES garment (garment_id) ON DELETE CASCADE,
    CONSTRAINT fk_gexc_staff FOREIGN KEY (flagged_by) REFERENCES staff (user_id),
    CONSTRAINT ck_gexc_type CHECK (exception_type IN ('DAMAGED','MISSING')),
    CONSTRAINT ck_gexc_notif CHECK (notification_status IN ('PENDING','SENT','FAILED'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- INVOICE, PAYMENT, REFUND  (S8, FR-11..14)
-- Invoice: many per order over time, but only ONE that is not VOID
-- (active_order_key). This lets a duplicate invoice be voided.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice (
    invoice_id       BIGINT        NOT NULL AUTO_INCREMENT,
    order_id         BIGINT        NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    generated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status           VARCHAR(15)   NOT NULL DEFAULT 'PENDING',
    active_order_key BIGINT GENERATED ALWAYS AS
        (CASE WHEN status <> 'VOID' THEN order_id ELSE NULL END) VIRTUAL,
    CONSTRAINT pk_invoice PRIMARY KEY (invoice_id),
    CONSTRAINT uq_one_active_invoice UNIQUE (active_order_key),
    CONSTRAINT fk_invoice_order FOREIGN KEY (order_id) REFERENCES orders (order_id),
    CONSTRAINT ck_invoice_amount CHECK (amount > 0),
    CONSTRAINT ck_invoice_status CHECK (status IN ('PENDING','PARTIALLY_PAID','PAID','VOID'))
) ENGINE=InnoDB;

-- gateway_ref is UNIQUE so one gateway transaction cannot be recorded
-- twice (duplicate detection, FR-13). No raw card data (NFR-03).
CREATE TABLE IF NOT EXISTS payment (
    payment_id     BIGINT        NOT NULL AUTO_INCREMENT,
    invoice_id     BIGINT        NOT NULL,
    amount         DECIMAL(12,2) NOT NULL,
    payment_date   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(10)   NOT NULL,
    status         VARCHAR(10)   NOT NULL DEFAULT 'PENDING',
    gateway_ref    VARCHAR(100)  NULL,
    CONSTRAINT pk_payment PRIMARY KEY (payment_id),
    CONSTRAINT uq_payment_gateway UNIQUE (gateway_ref),
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoice (invoice_id),
    CONSTRAINT ck_payment_amount CHECK (amount > 0),
    CONSTRAINT ck_payment_method CHECK (payment_method IN ('CASH','CARD','ONLINE')),
    CONSTRAINT ck_payment_status CHECK (status IN
        ('PENDING','SUCCESS','FAILED','DUPLICATE','REFUNDED')),
    INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB;

-- Refund needs Finance/Admin authorisation (FR-14): it starts REQUESTED;
-- decided_by / decided_at are filled when approved or rejected.
CREATE TABLE IF NOT EXISTS refund (
    refund_id  BIGINT        NOT NULL AUTO_INCREMENT,
    payment_id BIGINT        NOT NULL,
    amount     DECIMAL(12,2) NOT NULL,
    reason     VARCHAR(255)  NOT NULL,
    decided_by BIGINT        NULL,
    decided_at DATETIME      NULL,
    status     VARCHAR(10)   NOT NULL DEFAULT 'REQUESTED',
    CONSTRAINT pk_refund PRIMARY KEY (refund_id),
    CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES payment (payment_id),
    CONSTRAINT fk_refund_staff FOREIGN KEY (decided_by) REFERENCES staff (user_id),
    CONSTRAINT ck_refund_amount CHECK (amount > 0),
    CONSTRAINT ck_refund_status CHECK (status IN ('REQUESTED','APPROVED','REJECTED','PROCESSED')),
    CONSTRAINT ck_refund_decider CHECK (status = 'REQUESTED' OR decided_by IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- DELIVERY, DELIVERY_STATUS_HISTORY (weak), DELIVERY_INCIDENT (S7)
-- AssignedTo (Staff - Delivery) is delivery.assigned_staff_id.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery (
    delivery_id       BIGINT       NOT NULL AUTO_INCREMENT,
    order_id          BIGINT       NOT NULL,
    delivery_type     VARCHAR(10)  NOT NULL,
    address           VARCHAR(255) NOT NULL,
    scheduled_date    DATE         NOT NULL,
    scheduled_time    TIME         NOT NULL,
    assigned_staff_id BIGINT       NULL,
    status            VARCHAR(12)  NOT NULL DEFAULT 'SCHEDULED',
    CONSTRAINT pk_delivery PRIMARY KEY (delivery_id),
    CONSTRAINT fk_delivery_order FOREIGN KEY (order_id) REFERENCES orders (order_id),
    CONSTRAINT fk_delivery_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff (user_id),
    CONSTRAINT ck_delivery_type CHECK (delivery_type IN ('PICKUP','DROP_OFF')),
    CONSTRAINT ck_delivery_address CHECK (CHAR_LENGTH(TRIM(address)) > 0),
    CONSTRAINT ck_delivery_status CHECK (status IN
        ('SCHEDULED','PICKED_UP','IN_TRANSIT','DELIVERED','FAILED','CANCELLED')),
    INDEX idx_delivery_date (scheduled_date, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS delivery_status_history (
    history_id  BIGINT      NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT      NOT NULL,
    status      VARCHAR(12) NOT NULL,
    changed_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by  BIGINT      NULL,
    CONSTRAINT pk_delivery_history PRIMARY KEY (history_id),
    CONSTRAINT fk_dhist_delivery FOREIGN KEY (delivery_id)
        REFERENCES delivery (delivery_id) ON DELETE CASCADE,
    CONSTRAINT fk_dhist_staff FOREIGN KEY (changed_by) REFERENCES staff (user_id),
    CONSTRAINT ck_dhist_status CHECK (status IN
        ('SCHEDULED','PICKED_UP','IN_TRANSIT','DELIVERED','FAILED','CANCELLED'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS delivery_incident (
    incident_id BIGINT      NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT      NOT NULL,
    description TEXT        NOT NULL,
    reported_by BIGINT      NOT NULL,
    reported_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status      VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    CONSTRAINT pk_delivery_incident PRIMARY KEY (incident_id),
    CONSTRAINT fk_incident_delivery FOREIGN KEY (delivery_id) REFERENCES delivery (delivery_id),
    CONSTRAINT fk_incident_user FOREIGN KEY (reported_by) REFERENCES users (user_id),
    CONSTRAINT ck_incident_status CHECK (status IN ('OPEN','RESOLVED'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- AUDIT_LOG (FR-24, keep 1 year) and NOTIFICATION (FR-23)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id    BIGINT      NOT NULL AUTO_INCREMENT,
    actor_id    BIGINT      NOT NULL,
    action      VARCHAR(60) NOT NULL,
    entity_name VARCHAR(40) NULL,
    entity_id   BIGINT      NULL,
    occurred_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_value   TEXT        NULL,
    new_value   TEXT        NULL,
    CONSTRAINT pk_audit_log PRIMARY KEY (audit_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (actor_id) REFERENCES users (user_id),
    INDEX idx_audit_time (occurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification (
    notification_id  BIGINT      NOT NULL AUTO_INCREMENT,
    user_id          BIGINT      NOT NULL,
    related_order_id BIGINT      NULL,
    channel          VARCHAR(10) NOT NULL,
    message_type     VARCHAR(20) NOT NULL,
    sent_at          DATETIME    NULL,
    delivery_status  VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    retry_count      INT         NOT NULL DEFAULT 0,
    CONSTRAINT pk_notification PRIMARY KEY (notification_id),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_notif_order FOREIGN KEY (related_order_id) REFERENCES orders (order_id),
    CONSTRAINT ck_notif_channel CHECK (channel IN ('EMAIL','SMS')),
    CONSTRAINT ck_notif_type CHECK (message_type IN
        ('ORDER_READY','DELAY','PAYMENT','GARMENT_EXCEPTION','DELIVERY')),
    CONSTRAINT ck_notif_status CHECK (delivery_status IN ('PENDING','SENT','FAILED')),
    CONSTRAINT ck_notif_retry CHECK (retry_count >= 0)
) ENGINE=InnoDB;

-- =====================================================================
-- PART 2 : VIEWS
-- =====================================================================

-- Derived attribute Order.estimated_charge (S10)
CREATE OR REPLACE VIEW v_order_estimated_charge AS
SELECT o.order_id,
       COALESCE(SUM(g.quantity * g.unit_price), 0) AS estimated_charge
FROM orders o
LEFT JOIN garment g ON g.order_id = o.order_id
GROUP BY o.order_id;

-- Fully paid / partially paid / unpaid (S8)
CREATE OR REPLACE VIEW v_order_payment_status AS
SELECT i.order_id,
       i.invoice_id,
       i.amount AS invoice_amount,
       COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount END), 0) AS paid_amount,
       i.amount - COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount END), 0) AS balance,
       CASE
         WHEN i.status = 'VOID' THEN 'VOID'
         WHEN COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount END), 0) = 0 THEN 'UNPAID'
         WHEN COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount END), 0) < i.amount THEN 'PARTIALLY_PAID'
         ELSE 'PAID'
       END AS payment_state
FROM invoice i
LEFT JOIN payment p ON p.invoice_id = i.invoice_id
GROUP BY i.invoice_id, i.order_id, i.amount, i.status;

-- Active-orders dashboard (FR-07)
CREATE OR REPLACE VIEW v_active_orders AS
SELECT o.order_id, o.order_date, o.expected_completion_date, o.status,
       u.full_name AS customer_name, u.phone AS customer_phone,
       e.estimated_charge
FROM orders o
JOIN users u ON u.user_id = o.customer_id
JOIN v_order_estimated_charge e ON e.order_id = o.order_id
WHERE o.status NOT IN ('COMPLETED','CANCELLED');

-- Delayed / stalled orders (S9): past the expected date and still open
CREATE OR REPLACE VIEW v_delayed_orders AS
SELECT o.order_id, o.status, o.expected_completion_date,
       DATEDIFF(CURDATE(), o.expected_completion_date) AS days_late,
       u.full_name AS customer_name, u.phone AS customer_phone
FROM orders o
JOIN users u ON u.user_id = o.customer_id
WHERE o.status NOT IN ('COMPLETED','CANCELLED')
  AND o.expected_completion_date < CURDATE();

-- Dispatch board: daily routes and pending deliveries (FR-16)
CREATE OR REPLACE VIEW v_dispatch_board AS
SELECT d.delivery_id, d.scheduled_date, d.scheduled_time, d.delivery_type,
       d.address, d.status, d.order_id,
       cu.full_name AS customer_name, cu.phone AS customer_phone,
       su.full_name AS assigned_driver
FROM delivery d
JOIN orders o  ON o.order_id = d.order_id
JOIN users cu  ON cu.user_id = o.customer_id
LEFT JOIN users su ON su.user_id = d.assigned_staff_id
WHERE d.status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT');

-- Outstanding / unpaid payments report (S4)
CREATE OR REPLACE VIEW v_outstanding_payments AS
SELECT ps.order_id, ps.invoice_id, ps.invoice_amount, ps.paid_amount, ps.balance,
       ps.payment_state, u.full_name AS customer_name, u.phone AS customer_phone
FROM v_order_payment_status ps
JOIN orders o ON o.order_id = ps.order_id
JOIN users u ON u.user_id = o.customer_id
WHERE ps.payment_state IN ('UNPAID','PARTIALLY_PAID');

-- Daily payment collections by method (S8, S4 revenue report).
-- gross = payments that were SUCCESS or later REFUNDED, refunded = processed
-- refunds of those payments (attributed to the day of the payment),
-- net = gross - refunded.
CREATE OR REPLACE VIEW v_daily_collections AS
SELECT DATE(p.payment_date) AS collection_date,
       p.payment_method,
       COUNT(*)                                     AS payments,
       SUM(p.amount)                                AS gross_collected,
       COALESCE(SUM(r.refunded), 0)                 AS refunded,
       SUM(p.amount) - COALESCE(SUM(r.refunded), 0) AS net_collected
FROM payment p
LEFT JOIN (SELECT payment_id, SUM(amount) AS refunded
             FROM refund WHERE status = 'PROCESSED' GROUP BY payment_id) r
       ON r.payment_id = p.payment_id
WHERE p.status IN ('SUCCESS','REFUNDED')
GROUP BY DATE(p.payment_date), p.payment_method;

-- Receipt for each payment (S8)
CREATE OR REPLACE VIEW v_payment_receipt AS
SELECT p.payment_id,
       CONCAT('RCP-', LPAD(p.payment_id, 8, '0')) AS receipt_no,
       p.payment_date, p.amount, p.payment_method, p.status,
       i.order_id, u.full_name AS customer_name
FROM payment p
JOIN invoice i ON i.invoice_id = p.invoice_id
JOIN orders o  ON o.order_id = i.order_id
JOIN users u   ON u.user_id = o.customer_id;

-- Most popular laundry services (S4)
CREATE OR REPLACE VIEW v_popular_services AS
SELECT s.service_id, s.service_name,
       COUNT(g.garment_id)                      AS garment_lines,
       COALESCE(SUM(g.quantity), 0)             AS total_items,
       COALESCE(SUM(g.quantity * g.unit_price), 0) AS revenue
FROM laundry_service s
LEFT JOIN garment g ON g.service_id = s.service_id
GROUP BY s.service_id, s.service_name;

-- Daily order report; weekly/monthly by grouping this view (S4)
CREATE OR REPLACE VIEW v_order_report_daily AS
SELECT DATE(order_date) AS order_day,
       COUNT(*) AS total_orders,
       SUM(status = 'COMPLETED') AS completed,
       SUM(status = 'CANCELLED') AS cancelled,
       SUM(status NOT IN ('COMPLETED','CANCELLED')) AS pending
FROM orders
GROUP BY DATE(order_date);

-- Customer order history (FR-02, S11)
CREATE OR REPLACE VIEW v_customer_order_history AS
SELECT o.customer_id, u.full_name AS customer_name, o.order_id, o.order_date,
       o.status, e.estimated_charge, ps.payment_state
FROM orders o
JOIN users u ON u.user_id = o.customer_id
JOIN v_order_estimated_charge e ON e.order_id = o.order_id
LEFT JOIN v_order_payment_status ps
       ON ps.order_id = o.order_id AND ps.payment_state <> 'VOID';

-- Delivery status report (S4)
CREATE OR REPLACE VIEW v_delivery_status_summary AS
SELECT scheduled_date, status, COUNT(*) AS deliveries
FROM delivery
GROUP BY scheduled_date, status;

-- Employee directory (FR-22, S6)
CREATE OR REPLACE VIEW v_staff_directory AS
SELECT s.user_id, s.employee_no, u.full_name, u.phone, u.email,
       s.job_position, s.branch, s.department, s.date_of_joining, s.work_status,
       r.role_name AS active_role,
       sup.full_name AS supervisor_name
FROM staff s
JOIN users u ON u.user_id = s.user_id
LEFT JOIN staff_role sr ON sr.staff_id = s.user_id AND sr.status = 'ACTIVE'
LEFT JOIN role r ON r.role_id = sr.role_id
LEFT JOIN users sup ON sup.user_id = s.supervisor_id;

-- Employee schedules and duties (FR-22)
CREATE OR REPLACE VIEW v_staff_schedule AS
SELECT sh.shift_id, sh.shift_date, sh.start_time, sh.end_time, sh.duty,
       s.employee_no, u.full_name
FROM shift sh
JOIN staff s ON s.user_id = sh.staff_id
JOIN users u ON u.user_id = s.user_id;

-- Driver availability / workload for the dispatch board (FR-15)
CREATE OR REPLACE VIEW v_driver_workload AS
SELECT s.user_id AS driver_id, u.full_name AS driver_name,
       d.scheduled_date,
       COUNT(*)                                            AS assigned_jobs,
       MIN(d.scheduled_time)                               AS first_slot,
       MAX(d.scheduled_time)                               AS last_slot,
       GROUP_CONCAT(d.scheduled_time ORDER BY d.scheduled_time) AS booked_slots
FROM delivery d
JOIN staff s ON s.user_id = d.assigned_staff_id
JOIN users u ON u.user_id = s.user_id
WHERE d.status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT')
GROUP BY s.user_id, u.full_name, d.scheduled_date;

-- Audit trail in a readable form (FR-24)
CREATE OR REPLACE VIEW v_audit_trail AS
SELECT a.audit_id, a.occurred_at, u.full_name AS actor, a.action,
       a.entity_name, a.entity_id, a.old_value, a.new_value
FROM audit_log a
JOIN users u ON u.user_id = a.actor_id;

-- Integrity check: should return ZERO rows on a healthy database
CREATE OR REPLACE VIEW v_integrity_violations AS
SELECT 'CUSTOMER user without customer row' AS problem, u.user_id
FROM users u LEFT JOIN customer c ON c.user_id = u.user_id
WHERE u.user_type = 'CUSTOMER' AND c.user_id IS NULL
UNION ALL
SELECT 'STAFF user without staff row', u.user_id
FROM users u LEFT JOIN staff s ON s.user_id = u.user_id
WHERE u.user_type = 'STAFF' AND s.user_id IS NULL
UNION ALL
SELECT 'ACTIVE staff without an active role', s.user_id
FROM staff s LEFT JOIN staff_role sr ON sr.staff_id = s.user_id AND sr.status = 'ACTIVE'
WHERE s.work_status = 'ACTIVE' AND sr.staff_role_id IS NULL
UNION ALL
SELECT 'Active invoice amount differs from order total', i.invoice_id
FROM invoice i JOIN v_order_estimated_charge e ON e.order_id = i.order_id
WHERE i.status <> 'VOID' AND i.amount <> e.estimated_charge
UNION ALL
SELECT 'Driver double-booked in the same slot', d.delivery_id
FROM delivery d JOIN delivery d2
  ON d2.delivery_id <> d.delivery_id
 AND d2.assigned_staff_id = d.assigned_staff_id
 AND d2.scheduled_date = d.scheduled_date
 AND d2.scheduled_time = d.scheduled_time
 AND d2.status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT')
WHERE d.assigned_staff_id IS NOT NULL
  AND d.status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT');

-- =====================================================================
-- PART 3 : BUSINESS-RULE TRIGGERS AND INTERNAL PROCEDURE
-- =====================================================================
DELIMITER $$

-- Internal helper: recompute invoice status from its SUCCESS payments.
-- PENDING -> PARTIALLY_PAID -> PAID. If nothing is paid and the order is
-- cancelled the invoice becomes VOID.
DROP PROCEDURE IF EXISTS sp_refresh_invoice_status$$
CREATE PROCEDURE sp_refresh_invoice_status(IN p_invoice_id BIGINT)
BEGIN
    DECLARE v_amount DECIMAL(12,2);
    DECLARE v_status VARCHAR(15);
    DECLARE v_order_status VARCHAR(25);
    DECLARE v_paid DECIMAL(12,2);
    DECLARE v_new VARCHAR(15);

    SELECT i.amount, i.status, o.status
      INTO v_amount, v_status, v_order_status
      FROM invoice i JOIN orders o ON o.order_id = i.order_id
     WHERE i.invoice_id = p_invoice_id;

    IF v_status IS NOT NULL AND v_status <> 'VOID' THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_paid
          FROM payment WHERE invoice_id = p_invoice_id AND status = 'SUCCESS';
        SET v_new = CASE
            WHEN v_paid = 0 AND v_order_status = 'CANCELLED' THEN 'VOID'
            WHEN v_paid = 0 THEN 'PENDING'
            WHEN v_paid < v_amount THEN 'PARTIALLY_PAID'
            ELSE 'PAID' END;
        IF v_new <> v_status THEN
            UPDATE invoice SET status = v_new WHERE invoice_id = p_invoice_id;
        END IF;
    END IF;
END$$

-- Internal helper: resolve the actor of an audited change.
-- Uses @app_user_id when the application set it, otherwise the fallback
-- user that owns the record, so audit_log.actor_id is never NULL (FR-24).
DROP FUNCTION IF EXISTS fn_audit_actor$$
CREATE FUNCTION fn_audit_actor(p_fallback BIGINT) RETURNS BIGINT
READS SQL DATA
BEGIN
    DECLARE v_actor BIGINT DEFAULT NULL;
    IF @app_user_id IS NOT NULL THEN
        SELECT user_id INTO v_actor FROM users WHERE user_id = @app_user_id;
    END IF;
    RETURN COALESCE(v_actor, p_fallback);
END$$

-- ---------------- USERS / STAFF -------------------------------------
DROP TRIGGER IF EXISTS trg_users_bu$$
CREATE TRIGGER trg_users_bu BEFORE UPDATE ON users FOR EACH ROW
BEGIN
    IF NEW.user_type <> OLD.user_type THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A user type (CUSTOMER/STAFF) cannot be changed';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_staff_bi$$
CREATE TRIGGER trg_staff_bi BEFORE INSERT ON staff FOR EACH ROW
BEGIN
    DECLARE v_sup_status VARCHAR(10);
    IF NEW.supervisor_id IS NOT NULL THEN
        SELECT work_status INTO v_sup_status FROM staff WHERE user_id = NEW.supervisor_id;
        IF v_sup_status IS NULL OR v_sup_status <> 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supervisor must be an ACTIVE staff member';
        END IF;
    END IF;
END$$

-- Revoking access (FR-21): INACTIVE staff => user INACTIVE and roles REVOKED.
-- Onboarding is audited (SM01, FR-19)
DROP TRIGGER IF EXISTS trg_staff_ai$$
CREATE TRIGGER trg_staff_ai AFTER INSERT ON staff FOR EACH ROW
BEGIN
    INSERT INTO audit_log (actor_id, action, entity_name, entity_id, new_value)
    VALUES (fn_audit_actor(NEW.user_id), 'STAFF_ONBOARDED', 'staff', NEW.user_id,
            CONCAT('employee_no=', NEW.employee_no, ', position=', NEW.job_position));
END$$

DROP TRIGGER IF EXISTS trg_staff_au$$
CREATE TRIGGER trg_staff_au AFTER UPDATE ON staff FOR EACH ROW
BEGIN
    IF NEW.work_status <> OLD.work_status THEN
        IF NEW.work_status = 'INACTIVE' THEN
            UPDATE users SET status = 'INACTIVE' WHERE user_id = NEW.user_id;
            UPDATE staff_role SET status = 'REVOKED'
             WHERE staff_id = NEW.user_id AND status = 'ACTIVE';
        ELSE
            UPDATE users SET status = 'ACTIVE' WHERE user_id = NEW.user_id;
        END IF;
        INSERT INTO audit_log (actor_id, action, entity_name, entity_id, old_value, new_value)
        VALUES (fn_audit_actor(NEW.user_id),
                IF(NEW.work_status = 'INACTIVE', 'STAFF_ACCESS_REVOKED', 'STAFF_ACCESS_RESTORED'),
                'staff', NEW.user_id, OLD.work_status, NEW.work_status);
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_staff_role_bi$$
CREATE TRIGGER trg_staff_role_bi BEFORE INSERT ON staff_role FOR EACH ROW
BEGIN
    DECLARE v_work VARCHAR(10);
    IF NEW.status = 'ACTIVE' THEN
        SELECT work_status INTO v_work FROM staff WHERE user_id = NEW.staff_id;
        IF v_work IS NULL OR v_work <> 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Roles can only be assigned to ACTIVE staff';
        END IF;
    END IF;
END$$

-- Role assignment and revocation are audited (SM02, SM03, FR-20, FR-21)
DROP TRIGGER IF EXISTS trg_staff_role_ai$$
CREATE TRIGGER trg_staff_role_ai AFTER INSERT ON staff_role FOR EACH ROW
BEGIN
    DECLARE v_role VARCHAR(40);
    SELECT role_name INTO v_role FROM role WHERE role_id = NEW.role_id;
    INSERT INTO audit_log (actor_id, action, entity_name, entity_id, new_value)
    VALUES (fn_audit_actor(NEW.staff_id), 'ROLE_ASSIGNED', 'staff_role', NEW.staff_role_id, v_role);
END$$

DROP TRIGGER IF EXISTS trg_staff_role_au$$
CREATE TRIGGER trg_staff_role_au AFTER UPDATE ON staff_role FOR EACH ROW
BEGIN
    DECLARE v_role VARCHAR(40);
    IF NEW.status <> OLD.status THEN
        SELECT role_name INTO v_role FROM role WHERE role_id = NEW.role_id;
        INSERT INTO audit_log (actor_id, action, entity_name, entity_id, old_value, new_value)
        VALUES (fn_audit_actor(NEW.staff_id), 'ROLE_STATUS_CHANGED', 'staff_role',
                NEW.staff_role_id, CONCAT(v_role, '=', OLD.status), CONCAT(v_role, '=', NEW.status));
    END IF;
END$$

-- ---------------- ORDERS ---------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_bi$$
CREATE TRIGGER trg_orders_bi BEFORE INSERT ON orders FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(10);
    SELECT status INTO v_status FROM users WHERE user_id = NEW.customer_id;
    IF v_status IS NULL OR v_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Orders can only be created for ACTIVE customers';
    END IF;
    IF NEW.status <> 'RECEIVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new order must start with status RECEIVED';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_orders_bu$$
CREATE TRIGGER trg_orders_bu BEFORE UPDATE ON orders FOR EACH ROW
BEGIN
    IF NEW.customer_id <> OLD.customer_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The customer of an order cannot be changed';
    END IF;
    IF OLD.status IN ('COMPLETED','CANCELLED') AND NEW.status <> OLD.status THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A COMPLETED or CANCELLED order cannot change status';
    END IF;
    IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
        IF OLD.status <> 'RECEIVED' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An order can only be cancelled before processing begins';
        END IF;
        SET NEW.cancelled_at = IFNULL(NEW.cancelled_at, NOW());
    END IF;
    IF NEW.status = 'COMPLETED' AND OLD.status NOT IN ('READY_FOR_COLLECTION','OUT_FOR_DELIVERY','COMPLETED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An order can only be completed after it is ready or out for delivery';
    END IF;
END$$

-- Queue an "order ready" notification (FR-23)
DROP TRIGGER IF EXISTS trg_orders_au$$
CREATE TRIGGER trg_orders_au AFTER UPDATE ON orders FOR EACH ROW
BEGIN
    IF NEW.status = 'READY_FOR_COLLECTION' AND OLD.status <> 'READY_FOR_COLLECTION' THEN
        INSERT INTO notification (user_id, related_order_id, channel, message_type)
        VALUES (NEW.customer_id, NEW.order_id, 'SMS', 'ORDER_READY');
    END IF;
    -- every garment of the order moves with the order (FR-04, FR-08, S9)
    IF NEW.status <> OLD.status AND NEW.status IN
       ('RECEIVED','IN_WASHING','IN_DRY_CLEANING','IN_IRONING','QUALITY_CHECKED',
        'READY_FOR_COLLECTION','OUT_FOR_DELIVERY','COMPLETED') THEN
        UPDATE garment SET status = NEW.status WHERE order_id = NEW.order_id;
    END IF;
    -- cancellation is audited (OM03, FR-06, FR-24)
    IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
        INSERT INTO audit_log (actor_id, action, entity_name, entity_id, old_value, new_value)
        VALUES (fn_audit_actor(COALESCE(NEW.created_by_staff_id, NEW.customer_id)),
                'ORDER_CANCELLED', 'orders', NEW.order_id, OLD.status,
                CONCAT('CANCELLED: ', COALESCE(NEW.cancel_reason, 'no reason given')));
    END IF;
END$$

-- ---------------- GARMENTS -------------------------------------------
DROP TRIGGER IF EXISTS trg_garment_bi$$
CREATE TRIGGER trg_garment_bi BEFORE INSERT ON garment FOR EACH ROW
BEGIN
    DECLARE v_order_status VARCHAR(25);
    DECLARE v_avail VARCHAR(12);
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_next INT;

    SELECT status INTO v_order_status FROM orders WHERE order_id = NEW.order_id;
    IF v_order_status IS NULL OR v_order_status IN ('CANCELLED','COMPLETED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Garments cannot be added to a missing, cancelled or completed order';
    END IF;
    IF EXISTS (SELECT 1 FROM invoice WHERE order_id = NEW.order_id AND status <> 'VOID') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is already invoiced; void the invoice before changing garments';
    END IF;

    SELECT availability_status, price INTO v_avail, v_price
      FROM laundry_service WHERE service_id = NEW.service_id;
    IF v_avail IS NULL OR v_avail <> 'AVAILABLE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The selected laundry service is not available';
    END IF;

    IF NEW.unit_price IS NULL THEN SET NEW.unit_price = v_price; END IF;
    IF NEW.garment_no IS NULL THEN
        SELECT COALESCE(MAX(garment_no), 0) + 1 INTO v_next FROM garment WHERE order_id = NEW.order_id;
        SET NEW.garment_no = v_next;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_garment_bu$$
CREATE TRIGGER trg_garment_bu BEFORE UPDATE ON garment FOR EACH ROW
BEGIN
    IF NEW.order_id <> OLD.order_id OR NEW.garment_no <> OLD.garment_no THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A garment cannot be moved to another order or renumbered';
    END IF;
    IF (NEW.service_id <> OLD.service_id OR NEW.quantity <> OLD.quantity OR NEW.unit_price <> OLD.unit_price)
       AND EXISTS (SELECT 1 FROM invoice WHERE order_id = OLD.order_id AND status <> 'VOID') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is already invoiced; void the invoice before changing garments';
    END IF;
END$$

-- Remove a garment entered by mistake during sorting (FR-10)
DROP TRIGGER IF EXISTS trg_garment_bd$$
CREATE TRIGGER trg_garment_bd BEFORE DELETE ON garment FOR EACH ROW
BEGIN
    DECLARE v_order_status VARCHAR(25);
    SELECT status INTO v_order_status FROM orders WHERE order_id = OLD.order_id;
    IF v_order_status <> 'RECEIVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Garments can only be removed while the order is still RECEIVED (sorting)';
    END IF;
    IF EXISTS (SELECT 1 FROM invoice WHERE order_id = OLD.order_id AND status <> 'VOID') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is already invoiced; void the invoice before removing garments';
    END IF;
END$$

-- Queue a customer notification when a garment is flagged (FR-09)
DROP TRIGGER IF EXISTS trg_gexc_ai$$
CREATE TRIGGER trg_gexc_ai AFTER INSERT ON garment_exception FOR EACH ROW
BEGIN
    DECLARE v_customer BIGINT;
    DECLARE v_order BIGINT;
    SELECT o.customer_id, o.order_id INTO v_customer, v_order
      FROM garment g JOIN orders o ON o.order_id = g.order_id
     WHERE g.garment_id = NEW.garment_id;
    INSERT INTO notification (user_id, related_order_id, channel, message_type)
    VALUES (v_customer, v_order, 'SMS', 'GARMENT_EXCEPTION');
END$$

-- ---------------- INVOICE ---------------------------------------------
DROP TRIGGER IF EXISTS trg_invoice_bi$$
CREATE TRIGGER trg_invoice_bi BEFORE INSERT ON invoice FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(25);
    DECLARE v_charge DECIMAL(12,2);
    SELECT status INTO v_status FROM orders WHERE order_id = NEW.order_id;
    IF v_status IS NULL OR v_status = 'CANCELLED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A missing or cancelled order cannot be invoiced';
    END IF;
    SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_charge FROM garment WHERE order_id = NEW.order_id;
    IF v_charge <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The order has no garments to invoice';
    END IF;
    IF NEW.amount <> v_charge THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice amount must equal the order total';
    END IF;
    IF NEW.status <> 'PENDING' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new invoice must start as PENDING';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_invoice_bu$$
CREATE TRIGGER trg_invoice_bu BEFORE UPDATE ON invoice FOR EACH ROW
BEGIN
    IF NEW.order_id <> OLD.order_id OR NEW.amount <> OLD.amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The order and amount of an invoice cannot be changed';
    END IF;
    IF OLD.status = 'VOID' AND NEW.status <> 'VOID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A VOID invoice cannot be reopened';
    END IF;
END$$

-- Voiding an invoice is audited (PM04, FR-14, FR-24)
DROP TRIGGER IF EXISTS trg_invoice_au$$
CREATE TRIGGER trg_invoice_au AFTER UPDATE ON invoice FOR EACH ROW
BEGIN
    DECLARE v_fallback BIGINT;
    IF NEW.status = 'VOID' AND OLD.status <> 'VOID' THEN
        SELECT COALESCE(created_by_staff_id, customer_id) INTO v_fallback
          FROM orders WHERE order_id = NEW.order_id;
        INSERT INTO audit_log (actor_id, action, entity_name, entity_id, old_value, new_value)
        VALUES (fn_audit_actor(v_fallback), 'INVOICE_VOIDED', 'invoice', NEW.invoice_id,
                OLD.status, 'VOID');
    END IF;
END$$

-- ---------------- PAYMENT ---------------------------------------------
DROP TRIGGER IF EXISTS trg_payment_bi$$
CREATE TRIGGER trg_payment_bi BEFORE INSERT ON payment FOR EACH ROW
BEGIN
    DECLARE v_inv_status VARCHAR(15);
    DECLARE v_inv_amount DECIMAL(12,2);
    DECLARE v_paid DECIMAL(12,2);
    SELECT status, amount INTO v_inv_status, v_inv_amount FROM invoice WHERE invoice_id = NEW.invoice_id;
    IF v_inv_status IS NULL OR v_inv_status = 'VOID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payments cannot be recorded against a missing or VOID invoice';
    END IF;
    IF NEW.status = 'SUCCESS' THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_paid
          FROM payment WHERE invoice_id = NEW.invoice_id AND status = 'SUCCESS';
        IF v_paid + NEW.amount > v_inv_amount THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment would exceed the invoice amount';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_payment_bu$$
CREATE TRIGGER trg_payment_bu BEFORE UPDATE ON payment FOR EACH ROW
BEGIN
    DECLARE v_inv_amount DECIMAL(12,2);
    DECLARE v_paid DECIMAL(12,2);
    IF NEW.invoice_id <> OLD.invoice_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A payment cannot be moved to another invoice';
    END IF;
    IF OLD.status = 'SUCCESS' AND (NEW.amount <> OLD.amount OR NEW.status NOT IN ('SUCCESS','REFUNDED')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A successful payment can only change to REFUNDED';
    END IF;
    IF OLD.status IN ('REFUNDED') AND NEW.status <> 'REFUNDED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A REFUNDED payment cannot change status';
    END IF;
    IF NEW.status = 'SUCCESS' AND OLD.status <> 'SUCCESS' THEN
        SELECT amount INTO v_inv_amount FROM invoice WHERE invoice_id = NEW.invoice_id;
        SELECT COALESCE(SUM(amount), 0) INTO v_paid
          FROM payment WHERE invoice_id = NEW.invoice_id AND status = 'SUCCESS' AND payment_id <> NEW.payment_id;
        IF v_paid + NEW.amount > v_inv_amount THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment would exceed the invoice amount';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_payment_ai$$
CREATE TRIGGER trg_payment_ai AFTER INSERT ON payment FOR EACH ROW
BEGIN
    DECLARE v_customer BIGINT;
    DECLARE v_order BIGINT;
    CALL sp_refresh_invoice_status(NEW.invoice_id);
    IF NEW.status = 'SUCCESS' THEN
        SELECT o.customer_id, o.order_id INTO v_customer, v_order
          FROM invoice i JOIN orders o ON o.order_id = i.order_id WHERE i.invoice_id = NEW.invoice_id;
        INSERT INTO notification (user_id, related_order_id, channel, message_type)
        VALUES (v_customer, v_order, 'SMS', 'PAYMENT');
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_payment_au$$
CREATE TRIGGER trg_payment_au AFTER UPDATE ON payment FOR EACH ROW
BEGIN
    DECLARE v_customer BIGINT;
    DECLARE v_order BIGINT;
    CALL sp_refresh_invoice_status(NEW.invoice_id);
    IF NEW.status = 'SUCCESS' AND OLD.status <> 'SUCCESS' THEN
        SELECT o.customer_id, o.order_id INTO v_customer, v_order
          FROM invoice i JOIN orders o ON o.order_id = i.order_id WHERE i.invoice_id = NEW.invoice_id;
        INSERT INTO notification (user_id, related_order_id, channel, message_type)
        VALUES (v_customer, v_order, 'SMS', 'PAYMENT');
    END IF;
END$$

-- ---------------- REFUND ----------------------------------------------
-- Rules: only SUCCESS payments can be refunded; total of open refunds can
-- never exceed the payment; the decider must be an ACTIVE Business Owner
-- (the Finance/Admin authority named in FR-14). To also allow the Branch
-- Manager, add 'BRANCH_MANAGER' to the two IN (...) lists below.
DROP TRIGGER IF EXISTS trg_refund_bi$$
CREATE TRIGGER trg_refund_bi BEFORE INSERT ON refund FOR EACH ROW
BEGIN
    DECLARE v_pay_amount DECIMAL(12,2);
    DECLARE v_pay_status VARCHAR(10);
    DECLARE v_open DECIMAL(12,2);
    SELECT amount, status INTO v_pay_amount, v_pay_status FROM payment WHERE payment_id = NEW.payment_id;
    IF v_pay_status IS NULL OR v_pay_status <> 'SUCCESS' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only SUCCESS payments can be refunded';
    END IF;
    IF NEW.status <> 'REQUESTED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new refund must start as REQUESTED';
    END IF;
    SELECT COALESCE(SUM(amount), 0) INTO v_open
      FROM refund WHERE payment_id = NEW.payment_id AND status <> 'REJECTED';
    IF v_open + NEW.amount > v_pay_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refunds would exceed the original payment amount';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_refund_bu$$
CREATE TRIGGER trg_refund_bu BEFORE UPDATE ON refund FOR EACH ROW
BEGIN
    DECLARE v_pay_amount DECIMAL(12,2);
    DECLARE v_open DECIMAL(12,2);
    DECLARE v_authorised INT DEFAULT 0;
    IF NEW.payment_id <> OLD.payment_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A refund cannot be moved to another payment';
    END IF;
    IF OLD.status IN ('REJECTED','PROCESSED') AND NEW.status <> OLD.status THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A REJECTED or PROCESSED refund cannot change status';
    END IF;
    IF NEW.status <> 'REQUESTED' AND OLD.status = 'REQUESTED' THEN
        SELECT COUNT(*) INTO v_authorised
          FROM staff_role sr JOIN role r ON r.role_id = sr.role_id
         WHERE sr.staff_id = NEW.decided_by AND sr.status = 'ACTIVE'
           AND r.role_name IN ('BUSINESS_OWNER');
        IF v_authorised = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refunds must be authorised by the Business Owner (Finance/Admin)';
        END IF;
        SET NEW.decided_at = IFNULL(NEW.decided_at, NOW());
    END IF;
    IF NEW.amount <> OLD.amount THEN
        IF OLD.status <> 'REQUESTED' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a REQUESTED refund amount can be changed';
        END IF;
        SELECT amount INTO v_pay_amount FROM payment WHERE payment_id = NEW.payment_id;
        SELECT COALESCE(SUM(amount), 0) INTO v_open
          FROM refund WHERE payment_id = NEW.payment_id AND status <> 'REJECTED' AND refund_id <> NEW.refund_id;
        IF v_open + NEW.amount > v_pay_amount THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refunds would exceed the original payment amount';
        END IF;
    END IF;
END$$

-- When the refunds of a payment are fully PROCESSED the payment becomes REFUNDED.
DROP TRIGGER IF EXISTS trg_refund_au$$
CREATE TRIGGER trg_refund_au AFTER UPDATE ON refund FOR EACH ROW
BEGIN
    DECLARE v_pay_amount DECIMAL(12,2);
    DECLARE v_done DECIMAL(12,2);
    IF NEW.status = 'PROCESSED' AND OLD.status <> 'PROCESSED' THEN
        SELECT amount INTO v_pay_amount FROM payment WHERE payment_id = NEW.payment_id;
        SELECT COALESCE(SUM(amount), 0) INTO v_done
          FROM refund WHERE payment_id = NEW.payment_id AND status = 'PROCESSED';
        IF v_done >= v_pay_amount THEN
            UPDATE payment SET status = 'REFUNDED' WHERE payment_id = NEW.payment_id;
        END IF;
    END IF;
    -- every refund decision is audited with the authorising staff member (FR-14, FR-24)
    IF NEW.status <> OLD.status THEN
        INSERT INTO audit_log (actor_id, action, entity_name, entity_id, old_value, new_value)
        VALUES (fn_audit_actor(COALESCE(NEW.decided_by, NEW.payment_id * 0 + 1)),
                CONCAT('REFUND_', NEW.status), 'refund', NEW.refund_id,
                OLD.status, CONCAT(NEW.status, ' amount=', NEW.amount));
    END IF;
END$$

-- ---------------- DELIVERY --------------------------------------------
DROP TRIGGER IF EXISTS trg_delivery_bi$$
CREATE TRIGGER trg_delivery_bi BEFORE INSERT ON delivery FOR EACH ROW
BEGIN
    DECLARE v_order_status VARCHAR(25);
    DECLARE v_work VARCHAR(10);
    SELECT status INTO v_order_status FROM orders WHERE order_id = NEW.order_id;
    IF v_order_status IS NULL OR v_order_status IN ('CANCELLED','COMPLETED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Deliveries cannot be scheduled for a missing, cancelled or completed order';
    END IF;
    IF NEW.status <> 'SCHEDULED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new delivery must start as SCHEDULED';
    END IF;
    IF NEW.scheduled_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A delivery cannot be scheduled in the past';
    END IF;
    IF NEW.assigned_staff_id IS NOT NULL THEN
        SELECT work_status INTO v_work FROM staff WHERE user_id = NEW.assigned_staff_id;
        IF v_work IS NULL OR v_work <> 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The assigned staff member must be ACTIVE';
        END IF;
        -- a driver cannot hold two open jobs in the same slot (FR-15, DM01/DM04)
        IF EXISTS (SELECT 1 FROM delivery
                    WHERE assigned_staff_id = NEW.assigned_staff_id
                      AND scheduled_date = NEW.scheduled_date
                      AND scheduled_time = NEW.scheduled_time
                      AND status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT')) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That driver is already booked for this date and time slot';
        END IF;
    END IF;
END$$

-- Allowed status flow (FR-17, FR-18, S7):
--  SCHEDULED -> PICKED_UP / FAILED / CANCELLED
--  PICKED_UP -> IN_TRANSIT / DELIVERED / FAILED / CANCELLED
--  IN_TRANSIT -> DELIVERED / FAILED
--  FAILED    -> SCHEDULED (reschedule) / CANCELLED
--  DELIVERED and CANCELLED are final.
DROP TRIGGER IF EXISTS trg_delivery_bu$$
CREATE TRIGGER trg_delivery_bu BEFORE UPDATE ON delivery FOR EACH ROW
BEGIN
    DECLARE v_work VARCHAR(10);
    IF NEW.order_id <> OLD.order_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A delivery cannot be moved to another order';
    END IF;
    IF NEW.status <> OLD.status THEN
        IF NOT (
              (OLD.status = 'SCHEDULED'  AND NEW.status IN ('PICKED_UP','FAILED','CANCELLED'))
           OR (OLD.status = 'PICKED_UP'  AND NEW.status IN ('IN_TRANSIT','DELIVERED','FAILED','CANCELLED'))
           OR (OLD.status = 'IN_TRANSIT' AND NEW.status IN ('DELIVERED','FAILED'))
           OR (OLD.status = 'FAILED'     AND NEW.status IN ('SCHEDULED','CANCELLED'))
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This delivery status change is not allowed';
        END IF;
    END IF;
    IF OLD.status IN ('DELIVERED','CANCELLED') AND
       (NEW.scheduled_date <> OLD.scheduled_date OR NEW.scheduled_time <> OLD.scheduled_time
        OR NOT (NEW.assigned_staff_id <=> OLD.assigned_staff_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A DELIVERED or CANCELLED delivery cannot be changed';
    END IF;
    IF NEW.assigned_staff_id IS NOT NULL AND NOT (NEW.assigned_staff_id <=> OLD.assigned_staff_id) THEN
        SELECT work_status INTO v_work FROM staff WHERE user_id = NEW.assigned_staff_id;
        IF v_work IS NULL OR v_work <> 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The assigned staff member must be ACTIVE';
        END IF;
    END IF;
    -- rescheduling must not double-book the driver (FR-15, DM04)
    IF NEW.assigned_staff_id IS NOT NULL
       AND NEW.status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT')
       AND (NOT (NEW.assigned_staff_id <=> OLD.assigned_staff_id)
            OR NEW.scheduled_date <> OLD.scheduled_date
            OR NEW.scheduled_time <> OLD.scheduled_time
            OR NEW.status <> OLD.status) THEN
        IF EXISTS (SELECT 1 FROM delivery
                    WHERE delivery_id <> NEW.delivery_id
                      AND assigned_staff_id = NEW.assigned_staff_id
                      AND scheduled_date = NEW.scheduled_date
                      AND scheduled_time = NEW.scheduled_time
                      AND status IN ('SCHEDULED','PICKED_UP','IN_TRANSIT')) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That driver is already booked for this date and time slot';
        END IF;
    END IF;
END$$

-- Status history is written automatically. changed_by comes from the
-- optional session variable @app_user_id (NULL when not set).
DROP TRIGGER IF EXISTS trg_delivery_ai$$
CREATE TRIGGER trg_delivery_ai AFTER INSERT ON delivery FOR EACH ROW
BEGIN
    DECLARE v_actor BIGINT DEFAULT NULL;
    IF @app_user_id IS NOT NULL THEN
        SELECT user_id INTO v_actor FROM staff WHERE user_id = @app_user_id;
    END IF;
    INSERT INTO delivery_status_history (delivery_id, status, changed_by)
    VALUES (NEW.delivery_id, NEW.status, v_actor);
END$$

DROP TRIGGER IF EXISTS trg_delivery_au$$
CREATE TRIGGER trg_delivery_au AFTER UPDATE ON delivery FOR EACH ROW
BEGIN
    DECLARE v_actor BIGINT DEFAULT NULL;
    DECLARE v_customer BIGINT;
    IF NEW.status <> OLD.status THEN
        IF @app_user_id IS NOT NULL THEN
            SELECT user_id INTO v_actor FROM staff WHERE user_id = @app_user_id;
        END IF;
        INSERT INTO delivery_status_history (delivery_id, status, changed_by)
        VALUES (NEW.delivery_id, NEW.status, v_actor);
        IF NEW.status = 'FAILED' THEN
            SELECT customer_id INTO v_customer FROM orders WHERE order_id = NEW.order_id;
            INSERT INTO notification (user_id, related_order_id, channel, message_type)
            VALUES (v_customer, NEW.order_id, 'SMS', 'DELAY');
            -- downstream order status update for a missed delivery (FR-15, FR-17, DM03)
            UPDATE orders SET status = 'READY_FOR_COLLECTION'
             WHERE order_id = NEW.order_id AND status = 'OUT_FOR_DELIVERY';
        END IF;
    END IF;
END$$

-- =====================================================================
-- PART 4 : STORED PROCEDURES (multi-table operations, all-or-nothing)
-- =====================================================================

-- Register a customer: users + customer in one transaction (FR-01)
DROP PROCEDURE IF EXISTS sp_register_customer$$
CREATE PROCEDURE sp_register_customer(
    IN  p_full_name     VARCHAR(100),
    IN  p_email         VARCHAR(100),
    IN  p_phone         VARCHAR(20),
    IN  p_password_hash VARCHAR(255),
    IN  p_street        VARCHAR(150),
    IN  p_city          VARCHAR(80),
    IN  p_postal_code   VARCHAR(10),
    IN  p_notes         TEXT,
    OUT p_user_id       BIGINT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    INSERT INTO users (full_name, email, phone, password_hash, user_type)
    VALUES (p_full_name, p_email, p_phone, p_password_hash, 'CUSTOMER');
    SET p_user_id = LAST_INSERT_ID();
    INSERT INTO customer (user_id, street, city, postal_code, customer_notes)
    VALUES (p_user_id, p_street, p_city, p_postal_code, p_notes);
    COMMIT;
END$$

-- Onboard an employee with exactly one role: users + staff + staff_role (FR-19)
DROP PROCEDURE IF EXISTS sp_onboard_staff$$
CREATE PROCEDURE sp_onboard_staff(
    IN  p_full_name       VARCHAR(100),
    IN  p_email           VARCHAR(100),
    IN  p_phone           VARCHAR(20),
    IN  p_password_hash   VARCHAR(255),
    IN  p_employee_no     VARCHAR(20),
    IN  p_job_position    VARCHAR(50),
    IN  p_date_of_joining DATE,
    IN  p_salary          DECIMAL(12,2),
    IN  p_address         VARCHAR(255),
    IN  p_branch          VARCHAR(60),
    IN  p_department      VARCHAR(60),
    IN  p_emerg_name      VARCHAR(100),
    IN  p_emerg_phone     VARCHAR(20),
    IN  p_supervisor_id   BIGINT,
    IN  p_role_name       VARCHAR(40),
    OUT p_user_id         BIGINT)
BEGIN
    DECLARE v_role_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SELECT role_id INTO v_role_id FROM role WHERE role_name = p_role_name;
    IF v_role_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown role name';
    END IF;
    START TRANSACTION;
    INSERT INTO users (full_name, email, phone, password_hash, user_type, must_change_password)
    VALUES (p_full_name, p_email, p_phone, p_password_hash, 'STAFF', 1);
    SET p_user_id = LAST_INSERT_ID();
    INSERT INTO staff (user_id, employee_no, address, job_position, date_of_joining, salary,
                       branch, department, emergency_contact_name, emergency_contact_phone, supervisor_id)
    VALUES (p_user_id, p_employee_no, p_address, p_job_position, p_date_of_joining, p_salary,
            COALESCE(p_branch, 'Main Branch'), p_department, p_emerg_name, p_emerg_phone, p_supervisor_id);
    INSERT INTO staff_role (staff_id, role_id) VALUES (p_user_id, v_role_id);
    COMMIT;
END$$

-- Generate the invoice for an order from its garments (FR-11)
DROP PROCEDURE IF EXISTS sp_generate_invoice$$
CREATE PROCEDURE sp_generate_invoice(IN p_order_id BIGINT, OUT p_invoice_id BIGINT)
BEGIN
    DECLARE v_charge DECIMAL(12,2);
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = p_order_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found';
    END IF;
    IF EXISTS (SELECT 1 FROM invoice WHERE order_id = p_order_id AND status <> 'VOID') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This order already has an active invoice; void it before generating a new one';
    END IF;
    SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_charge FROM garment WHERE order_id = p_order_id;
    INSERT INTO invoice (order_id, amount) VALUES (p_order_id, v_charge);
    SET p_invoice_id = LAST_INSERT_ID();
END$$

-- Cancel an order before processing begins and reverse its effects (FR-06):
--  * order -> CANCELLED (the trigger refuses if processing already began)
--  * open deliveries -> CANCELLED
--  * every SUCCESS payment gets a REQUESTED refund for the full amount
--    (refunds still need Business Owner authorisation, FR-14)
--  * an unpaid invoice becomes VOID; a paid one becomes VOID automatically
--    once its payments are REFUNDED
DROP PROCEDURE IF EXISTS sp_cancel_order$$
CREATE PROCEDURE sp_cancel_order(IN p_order_id BIGINT, IN p_reason VARCHAR(255))
BEGIN
    DECLARE v_invoice BIGINT DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = p_order_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found';
    END IF;
    START TRANSACTION;
    UPDATE orders SET status = 'CANCELLED', cancel_reason = p_reason WHERE order_id = p_order_id;
    UPDATE delivery SET status = 'CANCELLED'
     WHERE order_id = p_order_id AND status IN ('SCHEDULED','PICKED_UP','FAILED');
    INSERT INTO refund (payment_id, amount, reason)
    SELECT p.payment_id, p.amount, CONCAT('Order cancelled: ', COALESCE(p_reason, 'no reason given'))
      FROM payment p JOIN invoice i ON i.invoice_id = p.invoice_id
     WHERE i.order_id = p_order_id AND p.status = 'SUCCESS'
       AND NOT EXISTS (SELECT 1 FROM refund r WHERE r.payment_id = p.payment_id AND r.status <> 'REJECTED');
    SELECT invoice_id INTO v_invoice FROM invoice WHERE order_id = p_order_id AND status <> 'VOID';
    IF v_invoice IS NOT NULL THEN
        CALL sp_refresh_invoice_status(v_invoice);
    END IF;
    COMMIT;
END$$

-- Change a password and clear the mandatory-change flag (CM03, SM01)
DROP PROCEDURE IF EXISTS sp_change_password$$
CREATE PROCEDURE sp_change_password(IN p_user_id BIGINT, IN p_new_hash VARCHAR(255))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
    END IF;
    IF CHAR_LENGTH(p_new_hash) < 20 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The password must be stored as a hash, never in plain text';
    END IF;
    UPDATE users SET password_hash = p_new_hash, must_change_password = 0
     WHERE user_id = p_user_id;
    INSERT INTO audit_log (actor_id, action, entity_name, entity_id, new_value)
    VALUES (fn_audit_actor(p_user_id), 'PASSWORD_CHANGED', 'users', p_user_id, 'password updated');
END$$

-- Record a gateway result once and only once (PM02, PM03, FR-13).
-- p_outcome: 'RECORDED' for a new result, 'DUPLICATE' when the same gateway
-- reference was already processed - the caller must NOT charge again.
DROP PROCEDURE IF EXISTS sp_record_payment$$
CREATE PROCEDURE sp_record_payment(
    IN  p_invoice_id  BIGINT,
    IN  p_amount      DECIMAL(12,2),
    IN  p_method      VARCHAR(10),
    IN  p_status      VARCHAR(10),
    IN  p_gateway_ref VARCHAR(100),
    OUT p_payment_id  BIGINT,
    OUT p_outcome     VARCHAR(10))
BEGIN
    DECLARE v_existing BIGINT DEFAULT NULL;
    IF p_gateway_ref IS NOT NULL THEN
        SELECT payment_id INTO v_existing FROM payment WHERE gateway_ref = p_gateway_ref;
    END IF;
    IF v_existing IS NOT NULL THEN
        SET p_payment_id = v_existing;
        SET p_outcome    = 'DUPLICATE';
    ELSE
        INSERT INTO payment (invoice_id, amount, payment_method, status, gateway_ref)
        VALUES (p_invoice_id, p_amount, p_method, p_status, p_gateway_ref);
        SET p_payment_id = LAST_INSERT_ID();
        SET p_outcome    = 'RECORDED';
    END IF;
END$$

-- A customer reads their own records only (FR-02, CM04)
DROP PROCEDURE IF EXISTS sp_customer_order_history$$
CREATE PROCEDURE sp_customer_order_history(IN p_customer_id BIGINT)
BEGIN
    SELECT o.order_id, o.order_date, o.expected_completion_date, o.status,
           e.estimated_charge, ps.payment_state
      FROM orders o
      JOIN v_order_estimated_charge e ON e.order_id = o.order_id
      LEFT JOIN v_order_payment_status ps
             ON ps.order_id = o.order_id AND ps.payment_state <> 'VOID'
     WHERE o.customer_id = p_customer_id
     ORDER BY o.order_date DESC;
END$$

-- Notification delivery result with retry and a staff alert (FR-23, FR-18).
-- After 3 failed attempts the notification is left FAILED and the failure is
-- written to the audit trail so staff can follow it up.
DROP PROCEDURE IF EXISTS sp_notification_result$$
CREATE PROCEDURE sp_notification_result(IN p_notification_id BIGINT, IN p_success TINYINT)
BEGIN
    DECLARE v_retry INT;
    DECLARE v_user  BIGINT;
    SELECT retry_count, user_id INTO v_retry, v_user
      FROM notification WHERE notification_id = p_notification_id;
    IF v_retry IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Notification not found';
    END IF;
    IF p_success = 1 THEN
        UPDATE notification SET delivery_status = 'SENT', sent_at = NOW()
         WHERE notification_id = p_notification_id;
    ELSE
        UPDATE notification
           SET retry_count = retry_count + 1,
               delivery_status = IF(retry_count + 1 >= 3, 'FAILED', 'PENDING')
         WHERE notification_id = p_notification_id;
        IF v_retry + 1 >= 3 THEN
            INSERT INTO audit_log (actor_id, action, entity_name, entity_id, new_value)
            VALUES (fn_audit_actor(v_user), 'NOTIFICATION_RETRIES_EXHAUSTED', 'notification',
                    p_notification_id, 'staff follow-up required');
        END IF;
    END IF;
END$$

-- Business summary for a selected period (S4).
-- Revenue figures follow the payment date; refunds are attributed to the
-- payment they belong to.
DROP PROCEDURE IF EXISTS sp_business_summary$$
CREATE PROCEDURE sp_business_summary(IN p_from DATE, IN p_to DATE)
BEGIN
    DECLARE v_gross DECIMAL(14,2);
    DECLARE v_refunded DECIMAL(14,2);
    SELECT COALESCE(SUM(amount), 0) INTO v_gross FROM payment
     WHERE status IN ('SUCCESS','REFUNDED') AND DATE(payment_date) BETWEEN p_from AND p_to;
    SELECT COALESCE(SUM(r.amount), 0) INTO v_refunded
      FROM refund r JOIN payment p ON p.payment_id = r.payment_id
     WHERE r.status = 'PROCESSED' AND DATE(p.payment_date) BETWEEN p_from AND p_to;
    SELECT
      (SELECT COUNT(*) FROM orders WHERE DATE(order_date) BETWEEN p_from AND p_to) AS total_orders,
      (SELECT COUNT(*) FROM orders WHERE DATE(order_date) BETWEEN p_from AND p_to
                                     AND status = 'COMPLETED') AS completed_orders,
      (SELECT COUNT(*) FROM orders WHERE DATE(order_date) BETWEEN p_from AND p_to
                                     AND status = 'CANCELLED') AS cancelled_orders,
      (SELECT COUNT(*) FROM orders WHERE DATE(order_date) BETWEEN p_from AND p_to
                                     AND status NOT IN ('COMPLETED','CANCELLED')) AS pending_orders,
      v_gross                AS gross_collected,
      v_refunded             AS refunded,
      v_gross - v_refunded   AS net_revenue,
      (SELECT COUNT(*) FROM delivery WHERE scheduled_date BETWEEN p_from AND p_to) AS total_deliveries,
      (SELECT COUNT(*) FROM delivery WHERE scheduled_date BETWEEN p_from AND p_to
                                       AND status = 'DELIVERED') AS delivered,
      (SELECT COUNT(*) FROM delivery WHERE scheduled_date BETWEEN p_from AND p_to
                                       AND status = 'FAILED') AS failed_deliveries;
END$$

DELIMITER ;

-- =====================================================================
-- PART 5 : REFERENCE DATA (safe to re-run; no passwords, no personal data)
-- =====================================================================
INSERT IGNORE INTO role (role_name, description) VALUES
 ('BUSINESS_OWNER',           'Business Owner / Administrator: full visibility, onboards staff, authorises refunds'),
 ('BRANCH_MANAGER',           'Supervises daily operations, garment processing and exceptions'),
 ('CUSTOMER_SERVICE_OFFICER', 'Registers customers and creates orders on their behalf'),
 ('CASHIER',                  'Records payments, issues receipts, requests refunds'),
 ('DELIVERY_COORDINATOR',     'Schedules and tracks pickups and drop-offs'),
 ('DRIVER',                   'Performs pickups and deliveries'),
 ('WASHER',                   'Sorts and washes garments');

INSERT IGNORE INTO laundry_service (service_name, description, price, estimated_completion_hours, availability_status) VALUES
 ('Washing',       'Standard machine wash',           150.00, 24, 'AVAILABLE'),
 ('Dry cleaning',  'Dry cleaning for delicate items', 450.00, 48, 'AVAILABLE'),
 ('Ironing',       'Ironing only',                     80.00, 12, 'AVAILABLE'),
 ('Wash and iron', 'Wash followed by ironing',        200.00, 24, 'AVAILABLE'),
 ('Stain removal', 'Special stain treatment',         250.00, 24, 'AVAILABLE'),
 ('Express',       'Same-day express service',        400.00,  6, 'AVAILABLE');
