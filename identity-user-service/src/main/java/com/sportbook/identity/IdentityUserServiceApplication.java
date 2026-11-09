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
    CommandLineRunner seedRoles(RoleRepository roles) {
        return args -> {
            seed(roles, "SPORTIF", "Joueur qui réserve des terrains");
            seed(roles, "GERANT", "Gérant de complexe sportif");
            seed(roles, "ADMIN", "Administrateur de la plateforme");
        };
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
