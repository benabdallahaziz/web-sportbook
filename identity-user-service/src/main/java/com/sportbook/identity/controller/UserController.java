package com.sportbook.identity.controller;

import com.sportbook.identity.dto.Dtos.*;
import com.sportbook.identity.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public List<UserResponse> all() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public UserResponse one(@PathVariable Long id) {
        return service.findById(id);
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        return service.update(id, req);
    }

    /** Bloquer / débloquer un compte (ADMIN). */
    @PatchMapping("/{id}/status")
    public UserResponse status(@PathVariable Long id, @Valid @RequestBody StatusRequest req,
                               @RequestHeader(value = "X-User-Roles", required = false) String callerRoles) {
        requireAdmin(callerRoles);
        return service.updateStatus(id, req.status());
    }

    /** Attribuer les rôles d'un compte : SPORTIF, GERANT, ADMIN (ADMIN). */
    @PutMapping("/{id}/roles")
    public UserResponse roles(@PathVariable Long id, @Valid @RequestBody RolesRequest req,
                              @RequestHeader(value = "X-User-Roles", required = false) String callerRoles) {
        requireAdmin(callerRoles);
        return service.updateRoles(id, req.roles());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id,
                       @RequestHeader(value = "X-User-Roles", required = false) String callerRoles) {
        requireAdmin(callerRoles);
        service.delete(id);
    }

    /**
     * Les actions d'administration exigent le rôle ADMIN, transmis par le frontend
     * dans l'en-tête X-User-Roles (même convention que tournament-events-service,
     * en attendant un jeton JWT).
     */
    private static void requireAdmin(String callerRoles) {
        boolean admin = callerRoles != null && java.util.Arrays.stream(callerRoles.split(","))
                .map(String::trim).anyMatch("ADMIN"::equalsIgnoreCase);
        if (!admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Action réservée à un administrateur");
        }
    }
}
