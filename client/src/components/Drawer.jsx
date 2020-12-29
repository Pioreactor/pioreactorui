import React from 'react';
import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
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

export default function SideDrawer() {
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
      <img alt="pioreactor logo" src="grey_color.png" width="40%" style={{marginLeft: "70px", marginTop: "5px"}}/>
      <List>

        <ListItem href="/" component="a" button key={"overview"} selected={isSelected("/") || isSelected("/overview")}>
          <ListItemIcon><DashboardIcon color={(isSelected("/") || isSelected("/overview")) ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Experiment Overview"} />
        </ListItem>

        <ListItem href="/download-data" component="a" button key={"download_data"} selected={isSelected("/download-data")}>
          <ListItemIcon><SaveAltIcon color={isSelected("/download-data") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Download experiment data"} />
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
      <Divider />
      <List>
        <ListItem>
          <ListItemText
            primary={<span style={{fontSize: ".9em"}}>Questions? Feedback? Email us at<br/><code><a href="mailto:support@pioreactor.com">support@pioreactor.com</a></code></span>}
          />
        </ListItem>
      </List>
    </div>
  );

  return (
      <React.Fragment key={"leftDrawer"}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={toggleDrawer(true)}
        >
          <MenuIcon />
        </IconButton>

        <Drawer
          anchor={"left"}
          open={isOpen}
          onClose={toggleDrawer(false)}
          onOpen={toggleDrawer(true)}
        >
          {list()}
        </Drawer>
      </React.Fragment>
  );
}
