package com.sportbook.identity.controller;

import com.sportbook.identity.entity.Role;
import com.sportbook.identity.repository.RoleRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final RoleRepository roles;

    public RoleController(RoleRepository roles) {
        this.roles = roles;
    }

    @GetMapping
    public List<Role> all() {
        return roles.findAll();
    }
}
