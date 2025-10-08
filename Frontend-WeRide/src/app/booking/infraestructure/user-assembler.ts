import { User } from '../domain/model/user.entity';
import { UserResponse } from './users-response';

// Convierte UserResponse (infraestructura) a User (dominio)
export function toDomainUser(response: UserResponse): User {
  return new User(
    response.id,
    response.name,
    response.email,
    response.phone,
    response.isActive
  );
}

// Convierte User (dominio) a UserResponse (infraestructura)
export function toInfraUser(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive
  };
}
