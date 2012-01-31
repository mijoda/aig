/**
 * Copyright (c) 2011 Paul Geromini 
 *
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Mixin.define("aiagallery.dbif.MPermissionGroup",
{
  construct : function()
  {
    this.registerService("aiagallery.features.addOrEditOrGetPermissionGroup",
                         this.addOrEditOrGetPermissionGroup,
                         [ "pGroupName", "pArray" ]);

    this.registerService("aiagallery.features.deletePermissionGroup",
                         this.deletePermissionGroup,
                         [ "pGroupName" ]);

    this.registerService("aiagallery.features.getPermissionGroups",
                         this.getPermissionGroups,
                         []);

  },

  members :
  {

    /**
     * Create a new permission group, edit an existing one, or get
     * an existing one. 
     *
     * @param pGroupName {String}
     *   This is a string to identify the name of the permission group
     *
     * @param pArray {Array}
     *   An array of strings of permissions
     *
     * @return {PermissionGroup || Error}
     *   This returns the actual permission group object, or an error if
     *   something went wrong
     *
     */
     addOrEditOrGetPermissionGroup : function(pGroupName, pArray)
     {
        // Create a new permission group
        // Use default permissions
        var pGroup = new aiagallery.dbif.ObjPermissionGroup(pGroupName);   
 
        if (pGroup.getBrandNew())
        {
          // New permission group, set with default information
          var pGroupData = pGroup.getData();

          pGroupData.name = pGroupName;
          
          // Use user supplied permissions
          pGroupData.permissions = pArray; 

          // Put this on the databse   
          pGroup.put();

          // Return new pGroup Data
          return pGroupData        
        } 
        else 
        {
          // Existing Permission Group
          // Get the data
          var pGroupData = pGroup.getData();
 
          if (pArray.length == 1 && pArray[0] == "get")
          {
            // Doing a single get, just get the data and return
            return pGroupData; 
          }
 
          // Update Permisssions
          pGroupData.permissions = pArray;

          // Put this on the databse   
          pGroup.put(); 

          // Return updated permission
          return pGroupData; 
          
        }

    },

    /**
     * Delete a permission group.
     *
     * @param pGroupName {String}
     *   This is a string to identify the name of the permission group
     *
     * @return {Boolean || Error}
     *   Returns true if delete was succesful, or an error if
     *   something went wrong
     *
     */
     deletePermissionGroup : function(pGroupName)
     {
        //Get permission group data
        var pGroup = new aiagallery.dbif.ObjPermissionGroup(pGroupName);   

        if (pGroup.getBrandNew() == true)
        {
           //Object does not exists return error
           return false;
        }
      
        pGroup.removeSelf(); 

        return true; 

    },

    /**
     * Get all the permission groups
     *
     * @return {Array || Error}
     *   This returns an array of permission groups, or an error if
     *   something went wrong
     *
     */
     getPermissionGroups : function()
     {       
          //Execute the query
          var permissionGroupsList = liberated.dbif.Entity.query(
                                    "aiagallery.dbif.ObjPermissionGroup");
                                     
          //Return the permission group list
          return permissionGroupsList;
     }
   }
}); 
