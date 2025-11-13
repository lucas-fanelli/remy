# Notification System Architecture

## Overview
The notification system has been refactored to follow **Clean Architecture** principles with proper separation of concerns, dependency inversion, and layered design.

## Architecture Layers

### 1. Domain Layer (`src/domain/`)
**Purpose**: Contains business rules, interfaces, and domain models. Framework-independent.

#### Domain Types (`src/domain/types/notification.ts`)
- **Notification Types**: Defines core notification domain models
  - `Notification`: Base notification entity
  - `NotificationWithSender`: Notification with populated sender details
  - `NotificationType`: Type-safe notification types ('follow' | 'like' | 'comment' | 'rating')

- **DTOs (Data Transfer Objects)**:
  - `CreateNotificationDTO`: For creating notifications
  - `UpdateNotificationDTO`: For updating notifications
  - `NotificationQueryOptions`: For querying with filters and pagination
  - `NotificationResponse`: API response structure

#### Repository Interface (`src/domain/repositories/INotificationRepository.ts`)
Defines the contract for data access operations:
- `create()`: Create a new notification
- `findById()`: Find by ID
- `findMany()`: Query with filters and pagination
- `findByRecipientId()`: Get notifications for a user
- `findUnreadByRecipientId()`: Get unread notifications
- `update()`: Update a notification
- `markAllAsRead()`: Mark all as read for a user
- `markAsRead()`: Mark specific notification as read
- `delete()`: Delete a notification
- `deleteMany()`: Bulk delete with filters
- `exists()`: Check if notification exists
- `getUnreadCount()`: Get unread count
- `getCount()`: Get total count
- `deleteOldReadNotifications()`: Cleanup old notifications

#### Service Interface (`src/domain/services/INotificationService.ts`)
Defines business logic operations:
- `getUserNotifications()`: Get paginated notifications
- `getUnreadNotifications()`: Get only unread
- `markAllAsRead()`: Mark all as read
- `markAsRead()`: Mark one as read
- `getUnreadCount()`: Get count
- `createFollowNotification()`: Create follow notification
- `createLikeNotification()`: Create like notification
- `createCommentNotification()`: Create comment notification
- `createRatingNotification()`: Create rating notification
- `deleteFollowNotification()`: Remove follow notification
- `deleteLikeNotification()`: Remove like notification
- `cleanupOldNotifications()`: Maintenance operation

### 2. Infrastructure Layer (`src/infrastructure/`)
**Purpose**: Implements domain interfaces with concrete technologies (Prisma, etc.)

#### Repository Implementation (`src/infrastructure/repositories/NotificationRepository.ts`)
- Implements `INotificationRepository` using Prisma ORM
- Handles all database operations
- Maps Prisma models to domain models
- **Single Responsibility**: Only data access, no business logic

**Key Features**:
- Type-safe database queries
- Proper error handling
- Domain model mapping
- Query optimization with indexes

#### Service Implementation (`src/infrastructure/services/NotificationService.ts`)
- Implements `INotificationService`
- Contains business logic and rules
- Uses `INotificationRepository` for data access
- **Dependency Inversion**: Depends on abstractions, not concretions

**Business Rules Implemented**:
- Don't create notification if user interacts with own content
- Don't create duplicate notifications for likes/ratings
- Automatic cleanup of old notifications

### 3. Presentation Layer (`src/app/api/`)
**Purpose**: Handles HTTP requests/responses

#### API Route (`src/app/api/notifications/route.ts`)
- **GET** `/api/notifications`: Get notifications with pagination
- **POST** `/api/notifications`: Mark all as read

**Responsibilities**:
- Authentication/authorization
- Request validation
- Query parameter parsing
- HTTP response formatting
- Error handling

**Clean Design**:
- Thin controller - delegates to service layer
- No business logic in routes
- Uses dependency injection container

### 4. Dependency Injection (`src/lib/container/container.ts`)
Manages all dependencies using Singleton pattern:

```typescript
// Registration
this.services.set('INotificationRepository',
  new NotificationRepository(prisma));

this.services.set('INotificationService',
  new NotificationService(notificationRepository));

// Usage
const notificationService = container.getNotificationService();
```

## Benefits of This Architecture

### 1. **Testability**
- Easy to mock interfaces
- Each layer can be tested independently
- Business logic isolated from infrastructure

### 2. **Maintainability**
- Clear separation of concerns
- Easy to understand and modify
- Single Responsibility Principle

### 3. **Flexibility**
- Easy to swap implementations (e.g., MongoDB instead of Prisma)
- Add new notification types without changing infrastructure
- Modify business rules in one place

### 4. **Type Safety**
- Full TypeScript support
- Compile-time error detection
- IntelliSense support

### 5. **Scalability**
- Can add caching layer without changing business logic
- Can add event-driven notifications
- Can add real-time notifications (WebSockets)

## SOLID Principles Applied

### Single Responsibility Principle (SRP)
- Repository: Only data access
- Service: Only business logic
- API Route: Only HTTP concerns

### Open/Closed Principle (OCP)
- Open for extension (new notification types)
- Closed for modification (interfaces stay stable)

### Liskov Substitution Principle (LSP)
- Any `INotificationRepository` implementation can replace another
- Any `INotificationService` implementation can replace another

### Interface Segregation Principle (ISP)
- Interfaces are focused and specific
- Clients don't depend on methods they don't use

### Dependency Inversion Principle (DIP)
- High-level modules (Service) depend on abstractions (IRepository)
- Low-level modules (Repository) depend on abstractions (IRepository)
- Abstractions don't depend on details

## Data Flow

```
Client Request
    ↓
[API Route] (route.ts)
    ↓ (validates, authenticates)
[Service Layer] (NotificationService)
    ↓ (business logic)
[Repository Layer] (NotificationRepository)
    ↓ (data access)
[Database] (PostgreSQL via Prisma)
    ↓
[Repository] (maps to domain models)
    ↓
[Service] (applies business rules)
    ↓
[API Route] (formats response)
    ↓
Client Response
```

## Example Usage

### Creating a Notification
```typescript
// In follow route
const notificationService = container.getNotificationService();
await notificationService.createFollowNotification(followerId, followingId);
```

### Getting Notifications
```typescript
// In API route
const notificationService = container.getNotificationService();
const result = await notificationService.getUserNotifications(userId, 50, 0);
// Returns: { notifications, unreadCount, total }
```

### Marking as Read
```typescript
const notificationService = container.getNotificationService();
await notificationService.markAllAsRead(userId);
```

## Migration Guide

### Old Approach (Direct Prisma in Route)
```typescript
// ❌ Bad: Business logic + data access in route
const notifications = await prisma.notification.findMany({
  where: { recipientId: userId },
  include: { sender: { select: { ... } } }
});
```

### New Approach (Layered Architecture)
```typescript
// ✅ Good: Separation of concerns
const notificationService = container.getNotificationService();
const result = await notificationService.getUserNotifications(userId);
```

## Future Enhancements

1. **Caching Layer**: Add Redis caching in service layer
2. **Real-time Notifications**: WebSocket support
3. **Email Notifications**: Add email service integration
4. **Push Notifications**: Mobile push notification support
5. **Notification Preferences**: User-configurable notification settings
6. **Batching**: Batch multiple notifications
7. **Priority System**: High/medium/low priority notifications

## Testing

### Unit Tests
```typescript
// Test repository with mocked Prisma
// Test service with mocked repository
// Test each layer independently
```

### Integration Tests
```typescript
// Test full flow from API to database
// Use test database
```

## Performance Considerations

1. **Database Indexes**: Added on `recipientId`, `isRead`, `createdAt`
2. **Pagination**: Limit/offset support
3. **Selective Loading**: Only load sender when needed
4. **Query Optimization**: Efficient Prisma queries
5. **Cleanup**: Automatic deletion of old read notifications

## Conclusion

This refactored architecture provides a solid, maintainable, and scalable foundation for the notification system. It follows industry best practices and makes the codebase easier to understand, test, and extend.
