package com.sportbook.identity.service;

import com.sportbook.identity.dto.Dtos.*;
import com.sportbook.identity.entity.Profile;
import com.sportbook.identity.entity.Role;
import com.sportbook.identity.entity.User;
import com.sportbook.identity.repository.RoleRepository;
import com.sportbook.identity.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@Service
@Transactional
public class UserService {

    private static final Set<String> SELF_REGISTER_ROLES = Set.of("SPORTIF", "GERANT");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "BLOCKED");
    private static final Set<String> ALL_ROLES = Set.of("SPORTIF", "GERANT", "ADMIN");

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;

    public UserService(UserRepository users, RoleRepository roles, PasswordEncoder encoder) {
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
    }

    public UserResponse register(RegisterRequest req) {
        if (users.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email déjà utilisé");
        }
        String roleName = (req.role() == null || req.role().isBlank()) ? "SPORTIF" : req.role().toUpperCase();
        if (!SELF_REGISTER_ROLES.contains(roleName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle autorisé : SPORTIF ou GERANT");
        }
        Role role = roles.findByName(roleName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Rôle introuvable"));

        User user = new User();
        user.setEmail(req.email());
        user.setPassword(encoder.encode(req.password()));
        user.getRoles().add(role);

        Profile profile = new Profile();
        profile.setFirstName(req.firstName());
        profile.setLastName(req.lastName());
        profile.setPhone(req.phone());
        profile.setAddress(req.address());
        profile.setUser(user);
        user.setProfile(profile);

        return toResponse(users.save(user));
    }

    @Transactional(readOnly = true)
    public UserResponse login(LoginRequest req) {
        User user = users.findByEmail(req.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect"));
        if (!encoder.matches(req.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect");
        }
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte bloqué");
        }
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return users.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public UserResponse findById(Long id) {
        return toResponse(get(id));
    }

    public UserResponse update(Long id, UpdateUserRequest req) {
        User user = get(id);
        Profile p = user.getProfile();
        if (p == null) {
            p = new Profile();
            p.setUser(user);
            user.setProfile(p);
        }
        if (req.firstName() != null) p.setFirstName(req.firstName());
        if (req.lastName() != null) p.setLastName(req.lastName());
        if (req.phone() != null) p.setPhone(req.phone());
        if (req.address() != null) p.setAddress(req.address());
        return toResponse(users.save(user));
    }

    public UserResponse updateStatus(Long id, String status) {
        String s = status.toUpperCase();
        if (!STATUSES.contains(s)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut autorisé : ACTIVE ou BLOCKED");
        }
        User user = get(id);
        user.setStatus(s);
        return toResponse(users.save(user));
    }

    /** Remplace les rôles d'un utilisateur (ADMIN). Le dernier administrateur ne peut pas perdre son rôle. */
    public UserResponse updateRoles(Long id, List<String> roleNames) {
        Set<String> wanted = new java.util.HashSet<>();
        for (String r : roleNames) {
            String name = r == null ? "" : r.trim().toUpperCase();
            if (!ALL_ROLES.contains(name)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle inconnu : " + r + " (SPORTIF, GERANT ou ADMIN)");
            }
            wanted.add(name);
        }
        User user = get(id);
        boolean wasAdmin = user.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getName()));
        if (wasAdmin && !wanted.contains("ADMIN") && users.countByRolesName("ADMIN") <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Impossible de retirer le rôle ADMIN au dernier administrateur");
        }
        Set<Role> newRoles = new java.util.HashSet<>();
        for (String name : wanted) {
            newRoles.add(roles.findByName(name)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Rôle introuvable : " + name)));
        }
        user.getRoles().clear();
        user.getRoles().addAll(newRoles);
        return toResponse(users.save(user));
    }

    public void delete(Long id) {
        User user = get(id);
        boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getName()));
        if (isAdmin && users.countByRolesName("ADMIN") <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Impossible de supprimer le dernier administrateur");
        }
        users.delete(user);
    }

    /** Crée le compte administrateur initial s'il n'existe aucun ADMIN (premier démarrage). */
    public void ensureDefaultAdmin(String email, String password) {
        if (users.existsByRolesName("ADMIN")) return;
        User user = users.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setPassword(encoder.encode(password));
            Profile p = new Profile();
            p.setFirstName("Admin");
            p.setLastName("SportBook");
            p.setUser(u);
            u.setProfile(p);
            return u;
        });
        user.getRoles().add(roles.findByName("ADMIN")
                .orElseThrow(() -> new IllegalStateException("Rôle ADMIN introuvable")));
        users.save(user);
    }

    private User get(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur " + id + " introuvable"));
    }

    private UserResponse toResponse(User u) {
        Profile p = u.getProfile();
        return new UserResponse(
                u.getId(), u.getEmail(), u.getStatus(),
                p != null ? p.getFirstName() : null,
                p != null ? p.getLastName() : null,
                p != null ? p.getPhone() : null,
                p != null ? p.getAddress() : null,
                u.getRoles().stream().map(Role::getName).sorted().toList());
    }
}
