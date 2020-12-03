import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import List from '@material-ui/core/List';
import {Typography} from '@material-ui/core';
import Divider from '@material-ui/core/Divider';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuIcon from '@material-ui/icons/Menu';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import AddIcon from '@material-ui/icons/Add';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import SettingsIcon from '@material-ui/icons/Settings';
import DashboardIcon from '@material-ui/icons/Dashboard';
import BatteryStdIcon from '@material-ui/icons/BatteryStd';

const useStyles = makeStyles({
  list: {
    width: 250,
  },
  fullList: {
    width: 'auto',
  },
});

export default function Drawer() {
  const classes = useStyles();
  const [isOpen, setIsOpen] = React.useState(false)

  function isSelected(path) {
    return (window.location.pathname === path)
  }



  const toggleDrawer = (open) => (event) => {
    if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setIsOpen(open);
  };

  const list = () => (
    <div
      role="presentation"
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      <img src="grey_color.png" width="40%" style={{marginLeft: "70px", marginTop: "5px"}}/>
      <List>

        <ListItem href="/" component="a" button key={"dashboard"} selected={isSelected("/")}>
          <ListItemIcon><DashboardIcon color={isSelected("/") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Dashboard"} />
        </ListItem>

        <ListItem href="/download-data" component="a" button key={"download_data"} selected={isSelected("/download-data")}>
          <ListItemIcon><SaveAltIcon color={isSelected("/download-data") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Download experiment data"} />
        </ListItem>

        <ListItem button href="/start-new-experiment"  component="a" key={"start_new_experiment"} selected={isSelected("/start-new-experiment")}>
          <ListItemIcon> <AddIcon color={isSelected("/start-new-experiment") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Start new experiment"} />
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListItem button href="/edit-config"  component="a" key={"edit_config"} selected={isSelected("/edit-config")}>
          <ListItemIcon> <EditIcon color={isSelected("/edit-config") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Edit config.ini"} />
        </ListItem>
        <ListItem button href="/calibrate"  component="a" key={"calibrate"} selected={isSelected("/calibrate")}>
          <ListItemIcon> <SettingsIcon color={isSelected("/calibrate") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Calibrate unit"} />
        </ListItem>

        <ListItem button href="/add-new-pioreactor"  component="a" key={"add-new-pioreactor"} selected={isSelected("/add-new-pioreactor")}>
          <ListItemIcon> <BatteryStdIcon color={isSelected("/add-new-pioreactor") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Add new Pioreactor"} />
        </ListItem>

      </List>
    </div>
  );

  return (
    <div>
      <React.Fragment key={"left"}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={toggleDrawer(true)}
        >
          <MenuIcon />
        </IconButton>

        <SwipeableDrawer
          anchor={"left"}
          open={isOpen}
          onClose={toggleDrawer(false)}
          onOpen={toggleDrawer(true)}
        >
          {list()}
        </SwipeableDrawer>
      </React.Fragment>
    </div>
  );
}
