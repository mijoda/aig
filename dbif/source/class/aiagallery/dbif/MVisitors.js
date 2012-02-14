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
                         [ "id", "attributes" ]);

    this.registerService("aiagallery.features.whitelistVisitors",
                         this.whitelistVisitors,
                         [ "id", "bAllowAccess" ]);

    this.registerService("aiagallery.features.deleteVisitor",
                         this.deleteVisitor,
                         [ "id" ]);

    this.registerService("aiagallery.features.editProfile",
                         this.editProfile,
                         [ "profileParams" ]);

    this.registerService("aiagallery.features.getVisitorListAndPGroups",
                         this.getVisitorListAndPGroups,
                         [ "bStringize" ]);
  },
  
  statics :
  {
    getVisitorPermissions : function(visitorData)
    {
      var             pGroups;
      var             permissions = visitorData.permissions || [];
      var             permMap = {};
      
      // Add each permission to a map, so we can detect duplicates later
      permissions.forEach(
        function(perm)
        {
          permMap[perm] = true;
        });
      
      // Get the permission groups that this visitor is a member of
      pGroups = visitorData.permissionGroups || [];
      pGroups.forEach(
        function(pGroup)
        {
          var             thisGroupPermissions;
          
          thisGroupPermissions = liberated.dbif.Entity.query(
            "aiagallery.dbif.ObjPermissionGroup",
            pGroup);
          
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
     * Exchange id for user's displayName
     * 
     *@param id {String}
     * Visitor's id
     * 
     *@return {String}
     * Visitor's display name 
     */
    _getDisplayName : function(id, error)
    {
      
      var visitor = new aiagallery.dbif.ObjVisitors(id);
     
      if (qx.core.Environment.get("qx.debug"))
      {
        // Ensure that an error object is passed
        qx.core.Assert.assertInstance(error,
                                      liberated.rpc.error.Error,
                                      "Need error object");
      }

      // Was our id faulty in some way?
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
    }
    
    /**
     * Exchange user's displayName for id
     * 
     *@param displayName {String}
     * Visitor's display name
     * 
     *@return {String} 
     * Visitor's id
     */
/*
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
*/
  },
  
  members :
  {
    addOrEditVisitor : function(id, attributes)
    {
      var             email;
      var             displayName;
      var             permissions;
      var             permissionGroups;
      var             status;
      var             statusIndex;
      var             visitor;
      var             visitorData;
      var             ret;
      
      email = attributes.email;
      displayName = attributes.displayName;
      permissions = attributes.permissions;
      permissionGroups = attributes.permissionGroups; 
      
      // Get the status value. If the status string isn't found, we'll use
      // "Active" when we set the database.
      status = aiagallery.dbif.Constants.StatusToName.indexOf(status);
      
      // Get the old visitor entry
      visitor = new aiagallery.dbif.ObjVisitors(id);
      visitorData = visitor.getData();
      
      // Provide the new data
      visitor.setData(
        {
          id          : id,
          email       : email,
          displayName : displayName || visitorData.displayName || "<>",
          permissions : permissions || visitorData.permissions || [],
          permissionGroups :
            permissionGroups || visitorData.permissionGroups || [],
          status      : status != -1 ? status : (visitorData.status || 2)
        });
      
      // Write the new data
      visitor.put();

      return visitor.getData();
    },
    
    /**
     * Add or remove a list of visitors, identified by their email addresses,
     * from the whitelist.
     *
     * @param emailAddresses {Array}
     *   List of the email addresses of visitors whose whitelist access should
     *   be altered.
     *
     * @param bAllowAccess {Boolean}
     *   Whether all of the visitors should have whitelist access enabled (or
     *   removed).
     *
     * @return {Map}
     *   The key fields in the map are the email addresses specified in
     *   emailAddresses. The values are booleans indicating whether the email
     *   address was found and updated.
     */
    whitelistVisitors : function(emailAddresses, bAllowAccess, error)
    {
      var             visitor;
      var             visitorData;
      var             pGroups;
      var             ret =
        {
          successes : [],
          failures  : []
        };

      emailAddresses.forEach(
        function(email)
        {
          liberated.dbif.Entity.asTransaction(
            function()
            {
              // Find this visitor by his email address
              visitorData = liberated.dbif.Entity.query(
                "aiagallery.dbif.ObjVisitors",
                {
                  type : "element",
                  field : "email",
                  value : email
                });

              // Ensure that we found this visitor
              if (visitorData.length != 1)
              {
                // Indicate that we failed to update this visitor
                ret.failures.push(email);
                return;
              }

              // Retrieve this visitor object
              visitor = new aiagallery.dbif.ObjVisitors(visitorData[0].id);
              
              // Since the query returned him, he better not be brand new!
              if (visitor.getBrandNew())
              {
                // Indicate that we failed to update this visitor
                ret.failures.push(email);
                return;
              }

              // Retrieve this visitor data, and specifically, the permission
              // groups array.
              visitorData = visitor.getData();
              pGroups = visitorData.permissionGroups || [];

              // First remove "Whitelist" from the list of permission groups.
              // (It may or may not actually be there.)
              qx.lang.Array.remove(pGroups,
                                   aiagallery.dbif.Constants.WHITELIST);

              // Now, if we're told to allow access, ...
              if (bAllowAccess)
              {
                // ... then add it in
                pGroups.push(aiagallery.dbif.Constants.WHITELIST);
              }

              // Replace the old list of permission groups
              visitorData.permissionGroups = pGroups;

              // Save the visitor
              visitor.put();
              
              // Indicate that we successfully updated this visitor
              ret.successes.push(email);
            });
        });
      
      // Give 'em the map of success/failure indications
      return ret;
    },

    deleteVisitor : function(id)
    {
      var             visitor;

      // Retrieve this visitor
      visitor = new aiagallery.dbif.ObjVisitors(id);

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
      me = new aiagallery.dbif.ObjVisitors(whoami.id);
      
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
              bValid = (fields[fieldName] == "Integer" || 
                        fields[fieldName] == "Float");
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
