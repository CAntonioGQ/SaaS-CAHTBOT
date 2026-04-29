import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

// Local Strategy: validates email + password for the login endpoint.
// Passport calls validate() with the username/password from req.body.
// If valid, the result becomes req.user for the login controller.
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' }); // use 'email' instead of default 'username'
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateCredentials(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }
}
