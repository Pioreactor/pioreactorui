import React from 'react';
import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuIcon from '@material-ui/icons/Menu';
import IconButton from '@material-ui/core/IconButton';
import SettingsIcon from '@material-ui/icons/Settings';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import DashboardIcon from '@material-ui/icons/Dashboard';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import UpdateIcon from '@material-ui/icons/Update';
import PioreactorIcon from './PioreactorIcon';

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
        <ListItem button href="/pioreactors"  component="a" key={"pioreactors"} selected={isSelected("/pioreactors")}>
          <ListItemIcon> <PioreactorIcon color={isSelected("/pioreactors") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Pioreactors"} />
        </ListItem>


      </List>
      <Divider />
      <List>
        <ListItem button href="/config"  component="a" key={"config"} selected={isSelected("/config")}>
          <ListItemIcon> <SettingsIcon color={isSelected("/config") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Configuration"} />
        </ListItem>
        <ListItem href="/download-data" component="a" button key={"download_data"} selected={isSelected("/download-data")}>
          <ListItemIcon><SaveAltIcon color={isSelected("/download-data") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primary={"Download data"} />
        </ListItem>

      </List>
      <Divider />
      <List>
        <ListItem target="_blank" href="https://pioreactor.com/pages/documentation" component="a" button key="help">
          <ListItemIcon><HelpOutlineIcon/> </ListItemIcon>
          <ListItemText primary={"Documentation"} />
        </ListItem>
        <ListItem href="/updates" component="a" button key="updates">
          <ListItemIcon><UpdateIcon/> </ListItemIcon>
          <ListItemText primary={"Updates"} />
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
