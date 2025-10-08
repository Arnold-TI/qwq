import { UserResponse, UsersListResponse } from './users-response';

// Servicio simulado para consumir la API de usuarios
export class UsersApiEndpoint {
  private users: UserResponse[] = [];

  // Obtener todos los usuarios
  async getAll(): Promise<UsersListResponse> {
    return { users: this.users };
  }

  // Crear un nuevo usuario
  async create(user: Omit<UserResponse, 'id'>): Promise<UserResponse> {
    const newUser: UserResponse = {
      ...user,
      id: Math.random().toString(36).substring(2)
    };
    this.users.push(newUser);
    return newUser;
  }

  // Obtener un usuario por ID
  async getById(id: string): Promise<UserResponse | undefined> {
    return this.users.find(u => u.id === id);
  }
}

