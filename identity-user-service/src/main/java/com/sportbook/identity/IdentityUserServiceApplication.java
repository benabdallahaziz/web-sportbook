package com.sportbook.identity;

import com.sportbook.identity.entity.Role;
import com.sportbook.identity.repository.RoleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableDiscoveryClient
public class IdentityUserServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdentityUserServiceApplication.class, args);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Crée les rôles de base au démarrage s'ils n'existent pas. */
    @Bean
    @org.springframework.core.annotation.Order(1)
    CommandLineRunner seedRoles(RoleRepository roles) {
        return args -> {
            seed(roles, "SPORTIF", "Joueur qui réserve des terrains");
            seed(roles, "GERANT", "Gérant de complexe sportif");
            seed(roles, "ADMIN", "Administrateur de la plateforme");
        };
    }

    /** Compte administrateur initial (créé seulement s'il n'existe encore aucun ADMIN). */
    @Bean
    @org.springframework.core.annotation.Order(2)
    CommandLineRunner seedAdmin(com.sportbook.identity.service.UserService users,
                                @org.springframework.beans.factory.annotation.Value("${sportbook.admin.email:admin@sportbook.tn}") String email,
                                @org.springframework.beans.factory.annotation.Value("${sportbook.admin.password:admin123}") String password) {
        return args -> users.ensureDefaultAdmin(email, password);
    }

    private void seed(RoleRepository roles, String name, String description) {
        if (roles.findByName(name).isEmpty()) {
            Role r = new Role();
            r.setName(name);
            r.setDescription(description);
            roles.save(r);
        }
    }
}
