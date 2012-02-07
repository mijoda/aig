/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Mixin.define("aiagallery.dbif.MVisitors",
{
  construct : function()
  {
    this.registerService("aiagallery.features.addOrEditVisitor",
                         this.addOrEditVisitor,
                         [ "userId", "attributes" ]);

    this.registerService("aiagallery.features.deleteVisitor",
                         this.deleteVisitor,
                         [ "userId" ]);

    this.registerService("aiagallery.features.getVisitorList",
                         this.getVisitorList,
                         [ "bStringize" ]);
    
    this.registerService("aiagallery.features.editProfile",
                         this.editProfile,
                         [ "profileParams" ]);

    this.registerService("aiagallery.features.getVisitorListAndPGroups",
                         this.getVisitorListAndPGroups,
                         [ "bStringize" ]);
  },
  
  statics :
  {
    getVisitorPermissions : function(visitor)
    {
      var             pGroups;
      var             permMap = {};
      
      // Add each permission to a map, so we can detect duplicates later
      visitor.permissions.forEach(
        function(perm)
        {
          permMap[perm] = true;
        });
      
      // Get the permission groups that this visitor is a member of
      pGroups = visitor.permissionGroups;
      
      pGroups.forEach(
        function(pGroup)
        {
          var             thisGroupPermissions;
          
          thisGroupPermissions = liberated.dbif.Entity.query(
            "aiagallery.dbif.ObjPermissionGroup",
            {
              type  : "element",
              field : "name",
              value : pGroup
            });
          
          thisGroupPermissions.forEach(
            function(thisGroupPermission)
            {
              thisGroupPermission.permissions.forEach(
                function(perm)
                {
                  permMap[perm] = true;
                });
            });
        });
      
      return qx.lang.Object.getKeys(permMap);
    },

    /**
     * Exchange userId for user's displayName
     * 
     *@param userId {String}
     * Visitor's userId
     * 
     *@return {String}
     * Visitor's display name 
     */
    _getDisplayName : function(userId, error)
    {
      
      var visitor = new aiagallery.dbif.ObjVisitors(userId);
     
      if (qx.core.Environment.get("qx.debug"))
      {
        // Ensure that an error object is passed
        qx.core.Assert.assertInstance(error,
                                      liberated.rpc.error.Error,
                                      "Need error object");
      }

      // Was our userId faulty in some way?
      if (typeof visitor === "undefined" || 
          visitor === null ||
          visitor.getBrandNew())
      {
        // FIXME:
        if (false)
        {
          // Yes, report the error
          error.setCode(1);
          error.setMessage("Unrecognized user ID in MVisitors");
          return error;
        }
        else
        {
          return "<>";
        }
      }
      
      // No problems, give them the display name
      return visitor.getData().displayName;
    },
    
    /**
     * Exchange user's displayName for userId
     * 
     *@param displayName {String}
     * Visitor's display name
     * 
     *@return {String} 
     * Visitor's userId
     */
    _getVisitorId : function(displayName, error)
    {
      
      var owners = liberated.dbif.Entity.query(
        "aiagallery.dbif.ObjVisitors",
        {
          type  : "element",
          field : "displayName",
          value : displayName
          
        },
        // No resultCriteria. Only need a single result
        null);
      
      // Was there a problem with the query?
      if (typeof owners[0] === "undefined" || owners[0] === null)
      {
        // Yes, report the error
        error.setCode(2);
        error.setMessage("Unrecognized display name: " + displayName);
        return error;
      }
      
      // No problems, give them the ID
      return owners[0].id;
      
    }
            
  },
  
  members :
  {
    addOrEditVisitor : function(userId, attributes)
    {
      var             displayName;
      var             permissions;
      var             permissionGroups;
      var             status;
      var             statusIndex;
      var             visitor;
      var             visitorData;
      var             ret;
      
      displayName = attributes.displayName;
      permissions = attributes.permissions;
      permissionGroups = attributes.permissionGroups; 
      
      // Get the status value. If the status string isn't found, we'll use
      // "Active" when we set the database.
      status = aiagallery.dbif.Constants.StatusToName.indexOf(status);
      
      // Get the old visitor entry
      visitor = new aiagallery.dbif.ObjVisitors(userId);
      visitorData = visitor.getData();
      
      // Remember whether it already existed.
      ret = visitor.getBrandNew();
      
      // Provide the new data
      visitor.setData(
        {
          id          : userId,
          displayName : displayName || visitorData.displayName || "<>",
          permissions : permissions || visitorData.permissions || [],
          permissionGroups :
            permissionGroups || visitorData.permissionGroups || [],
          status      : status != -1 ? status : (visitorData.status || 2)
        });
      
      // Write the new data
      visitor.put();

      return ret;
    },
    
    deleteVisitor : function(userId)
    {
      var             visitor;

      // Retrieve this visitor
      visitor = new aiagallery.dbif.ObjVisitors(userId);

      // See if this visitor exists.
      if (visitor.getBrandNew())
      {
        // He doesn't. Let 'em know.
        return false;
      }
      
      // Delete the visitor
      visitor.removeSelf();
      
      // We were successful
      return true;
    },
    
    getVisitorList : function(bStringize)
    {
      var             visitor;
      var             visitorList;
      
      // For each visitor...
      visitorList = liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors");

      // If we were asked to stringize the values...
      if (bStringize)
      {
        // ... then do so
        for (visitor in visitorList)
        {
          var             thisGuy = visitorList[visitor];
          thisGuy.permissions = 
            thisGuy.permissions ? thisGuy.permissions.join(", ") : "";
          thisGuy.permissionGroups = 
            thisGuy.permissionGroups ? thisGuy.permissionGroups.join(", ") : "";
          thisGuy.status =
            [ "Banned", "Pending", "Active" ][thisGuy.status];
        }
      }
      
      // We've built the whole list. Return it.
      return visitorList;
    },
    
    editProfile : function(profileParams, error)
    {
      var             me;
      var             meData;
      var             whoami;
      var             propertyTypes;
      var             fields;
      var             bValid = true;
      var             validFields = 
        [
          "displayName"
        ];
      
      // Find out who we are
      whoami = this.getWhoAmI();

      // Retrieve the current user's visitor object
      me = new aiagallery.dbif.ObjVisitors(whoami.email);
      
      // Get my object data
      meData = me.getData();

      // Get the field names for this entity type
      propertyTypes = liberated.dbif.Entity.propertyTypes;
      fields = propertyTypes["visitors"].fields;

      // For each of the valid field names...
      try
      {
        validFields.forEach(
          function(fieldName)
          {

            // Is this field being modified?
            if (typeof profileParams[fieldName] == "undefined")
            {
              // Nope. Nothing to do with this one.
              return;
            }

            // Ensure that the value being set is correct for the field
            switch(typeof profileParams[fieldName])
            {
            case "string":
              bValid = (fields[fieldName] == "String");
              break;

            case "number":
              bValid = (fields[fieldName] == "Number");
              break;

            default:
              bValid = false;
              break;
            }

            // Is the new profile parameter of the correct type?
            if (! bValid)
            {
              // Nope.
              error.setCode(1);
              error.setMessage("Unexpected parameter type. " +
                               "Expected " + fields[fieldName] +
                               ", got " + typeof profileParams[fieldName]);
              throw error;
            }

            // Assign the new value.
            meData[fieldName] = profileParams[fieldName];
          });
      }
      catch(error)
      {
        return error;
      }
      
      // Save the altered profile data
      me.put();
      
      // We need to return something. true is as good as anything else.
      return true;
    },

    /**
     * Get all the permission groups and visitors
     *
     * @return {Array || Error}
     *   This a map permission groups and visitors, or an error if
     *   something went wrong
     *
     */
    getVisitorListAndPGroups : function(bStringize)
    {
      var             visitor;
      var             visitorList;
      
      // For each visitor...
      visitorList = liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors");

      // If we were asked to stringize the values...
      if (bStringize)
      {
        // ... then do so
        for (visitor in visitorList)
        {
          var thisGuy = visitorList[visitor];
          thisGuy.permissions = 
            thisGuy.permissions ? thisGuy.permissions.join(", ") : "";
          thisGuy.permissionGroups = 
            thisGuy.permissionGroups ? thisGuy.permissionGroups.join(", ") : "";
          thisGuy.status =
            aiagallery.dbif.Constants.StatusToName[thisGuy.status];
        }
      }    

      // Get the current list of permission groups
      var pGroupList = this.getPermissionGroups(); 
      
      // Construct a map
      var map = 
      {
        "visitors" : visitorList,
        "pGroups"  : pGroupList
      }; 
      
      // We've built the whole list. Return it.
      return map;
    }
  }
});
