// Respuesta de la API para un usuario
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

// Respuesta de la API para listado de usuarios
export interface UsersListResponse {
  users: UserResponse[];
}

