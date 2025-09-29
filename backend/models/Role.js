import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  resource: {
    type: String,
    required: true,
    enum: [
      'users', 'products', 'orders', 'payments', 'outlets', 'analytics', 
      'settings', 'reports', 'notifications', 'logs', 'cache', 'api-keys',
      'roles', 'permissions', 'mfa', 'sessions', 'social-auth'
    ]
  },
  actions: [{
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'execute', 'approve', 'reject'],
    required: true
  }],
  conditions: {
    type: mongoose.Schema.Types.Mixed, // For advanced conditions like ownership, time-based, etc.
    default: {}
  }
});

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters'],
    index: true
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  permissions: [permissionSchema],
  
  // Role hierarchy
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],
  
  // Role properties
  isSystem: {
    type: Boolean,
    default: false // System roles cannot be deleted
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: {
    type: Number,
    default: 0, // Higher numbers = higher priority
    index: true
  },
  
  // Usage statistics
  userCount: {
    type: Number,
    default: 0
  },
  
  // Restrictions
  maxUsers: {
    type: Number,
    default: null // null = unlimited
  },
  expiresAt: {
    type: Date,
    default: null // null = permanent
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
roleSchema.index({ name: 1, isActive: 1 });
roleSchema.index({ priority: -1, isActive: 1 });
roleSchema.index({ isSystem: 1, isActive: 1 });
roleSchema.index({ createdAt: -1 });

// Virtual for inherited permissions
roleSchema.virtual('inheritedPermissions').get(function() {
  // This would be populated by a method that traverses the hierarchy
  return [];
});

// Methods
roleSchema.methods.hasPermission = function(resource, action, conditions = {}) {
  return this.permissions.some(permission => 
    permission.resource === resource &&
    permission.actions.includes(action) &&
    this.checkConditions(permission.conditions, conditions)
  );
};

roleSchema.methods.checkConditions = function(permissionConditions, requestConditions) {
  if (!permissionConditions || Object.keys(permissionConditions).length === 0) {
    return true; // No conditions = always allowed
  }
  
  // Implement condition checking logic
  // Examples: ownership, time-based, IP-based, etc.
  return true; // Simplified for now
};

roleSchema.methods.addPermission = function(resource, actions, conditions = {}) {
  // Remove existing permission for the same resource
  this.permissions = this.permissions.filter(p => p.resource !== resource);
  
  // Add new permission
  this.permissions.push({
    resource,
    actions: Array.isArray(actions) ? actions : [actions],
    conditions
  });
};

roleSchema.methods.removePermission = function(resource) {
  this.permissions = this.permissions.filter(p => p.resource !== resource);
};

roleSchema.methods.getAllPermissions = async function() {
  let allPermissions = [...this.permissions];
  
  // Add inherited permissions from parent roles
  if (this.parent) {
    const parentRole = await mongoose.model('Role').findById(this.parent);
    if (parentRole) {
      const parentPermissions = await parentRole.getAllPermissions();
      allPermissions = [...allPermissions, ...parentPermissions];
    }
  }
  
  // Remove duplicates and merge actions for same resource
  const mergedPermissions = {};
  allPermissions.forEach(permission => {
    if (!mergedPermissions[permission.resource]) {
      mergedPermissions[permission.resource] = {
        resource: permission.resource,
        actions: new Set(permission.actions),
        conditions: permission.conditions
      };
    } else {
      permission.actions.forEach(action => 
        mergedPermissions[permission.resource].actions.add(action)
      );
    }
  });
  
  return Object.values(mergedPermissions).map(p => ({
    resource: p.resource,
    actions: Array.from(p.actions),
    conditions: p.conditions
  }));
};

roleSchema.methods.canAssignRole = function(targetRole) {
  // Check if this role can assign the target role
  // Usually based on hierarchy or specific permissions
  return this.priority >= targetRole.priority;
};

// Statics
roleSchema.statics.getSystemRoles = function() {
  return this.find({ isSystem: true, isActive: true });
};

roleSchema.statics.getRoleHierarchy = function() {
  return this.find({ isActive: true })
    .populate('parent children')
    .sort({ priority: -1 });
};

roleSchema.statics.createDefaultRoles = async function() {
  const defaultRoles = [
    {
      name: 'super_admin',
      displayName: 'Super Administrator',
      description: 'Full system access with all permissions',
      permissions: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'orders', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'payments', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'outlets', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'analytics', actions: ['read', 'execute'] },
        { resource: 'settings', actions: ['read', 'update'] },
        { resource: 'reports', actions: ['read', 'execute'] },
        { resource: 'notifications', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'logs', actions: ['read'] },
        { resource: 'cache', actions: ['read', 'update', 'delete'] },
        { resource: 'api-keys', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'roles', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'permissions', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'mfa', actions: ['read', 'update'] },
        { resource: 'sessions', actions: ['read', 'delete'] },
        { resource: 'social-auth', actions: ['read', 'update'] }
      ],
      isSystem: true,
      priority: 1000
    },
    {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Administrative access with most permissions',
      permissions: [
        { resource: 'users', actions: ['create', 'read', 'update'] },
        { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'orders', actions: ['create', 'read', 'update'] },
        { resource: 'payments', actions: ['read', 'update'] },
        { resource: 'outlets', actions: ['create', 'read', 'update'] },
        { resource: 'analytics', actions: ['read', 'execute'] },
        { resource: 'settings', actions: ['read'] },
        { resource: 'reports', actions: ['read', 'execute'] },
        { resource: 'notifications', actions: ['create', 'read'] },
        { resource: 'logs', actions: ['read'] },
        { resource: 'cache', actions: ['read'] }
      ],
      isSystem: true,
      priority: 800
    },
    {
      name: 'manager',
      displayName: 'Manager',
      description: 'Management access with limited permissions',
      permissions: [
        { resource: 'users', actions: ['read'] },
        { resource: 'products', actions: ['read', 'update'] },
        { resource: 'orders', actions: ['read', 'update'] },
        { resource: 'payments', actions: ['read'] },
        { resource: 'outlets', actions: ['read'] },
        { resource: 'analytics', actions: ['read'] },
        { resource: 'reports', actions: ['read'] }
      ],
      isSystem: true,
      priority: 600
    },
    {
      name: 'staff',
      displayName: 'Staff Member',
      description: 'Basic staff access for daily operations',
      permissions: [
        { resource: 'products', actions: ['read'] },
        { resource: 'orders', actions: ['read', 'update'] },
        { resource: 'outlets', actions: ['read'] }
      ],
      isSystem: true,
      priority: 400
    },
    {
      name: 'customer',
      displayName: 'Customer',
      description: 'Customer access for self-service operations',
      permissions: [
        { 
          resource: 'users', 
          actions: ['read', 'update'], 
          conditions: { ownership: 'self' } 
        },
        { resource: 'products', actions: ['read'] },
        { 
          resource: 'orders', 
          actions: ['create', 'read'], 
          conditions: { ownership: 'self' } 
        },
        { 
          resource: 'payments', 
          actions: ['create', 'read'], 
          conditions: { ownership: 'self' } 
        },
        { resource: 'outlets', actions: ['read'] }
      ],
      isSystem: true,
      priority: 200
    }
  ];

  for (const roleData of defaultRoles) {
    const existingRole = await this.findOne({ name: roleData.name });
    if (!existingRole) {
      await this.create({
        ...roleData,
        createdBy: null // System created
      });
    }
  }
};

// Pre-save middleware
roleSchema.pre('save', function(next) {
  if (this.isModified('permissions')) {
    // Sort permissions by resource for consistency
    this.permissions.sort((a, b) => a.resource.localeCompare(b.resource));
  }
  next();
});

// Pre-remove middleware
roleSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  if (this.isSystem) {
    throw new Error('Cannot delete system roles');
  }
  
  // Check if role is being used by users
  const User = mongoose.model('User');
  const userCount = await User.countDocuments({ role: this.name });
  
  if (userCount > 0) {
    throw new Error(`Cannot delete role: ${userCount} users are assigned to this role`);
  }
  
  next();
});

export default mongoose.model('Role', roleSchema);







