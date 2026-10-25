package com.sportbook.identity.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class Dtos {
    private Dtos() {}

    /** role : SPORTIF (défaut) ou GERANT. ADMIN ne peut pas être choisi à l'inscription. */
    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, message = "6 caractères minimum") String password,
            String firstName,
            String lastName,
            String phone,
            String address,
            String role) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record UpdateUserRequest(
            String firstName,
            String lastName,
            String phone,
            String address) {}

    public record StatusRequest(@NotBlank String status) {}

    /** Réponse publique : le mot de passe n'est jamais renvoyé. */
    public record UserResponse(
            Long id,
            String email,
            String status,
            String firstName,
            String lastName,
            String phone,
            String address,
            List<String> roles) {}
}
