# Notification API — Phase 5.1

The canonical backend-owned notification contract contains exactly five authenticated endpoints:

| Method   | Endpoint                     | Purpose                                                                |
| -------- | ---------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/v1/user-devices`           | List the current user's registered devices without exposing FCM tokens |
| `POST`   | `/v1/user-devices`           | Idempotently register or refresh an FCM device token                   |
| `DELETE` | `/v1/user-devices/:id`       | Deactivate one device owned by the current user                        |
| `GET`    | `/v1/notifications`          | Return paginated persisted notifications and the database unread total |
| `POST`   | `/v1/notifications/:id/view` | Idempotently mark an owned notification as viewed                      |

Clients cannot create notifications or choose recipients. Domain services create notifications only after successful business transitions. Firebase Admin sends the persisted notification to the recipient's active devices; FCM delivery failure never rolls back the domain transition or deletes the persisted notification.

The complete Swagger/OpenAPI contract, examples, authentication requirements, request bodies, pagination, and response schemas are in [`PHASE_5_1_OPENAPI.yaml`](./PHASE_5_1_OPENAPI.yaml).
