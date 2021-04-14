import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuIcon from '@material-ui/icons/Menu';
import IconButton from '@material-ui/core/IconButton';
import SettingsIcon from '@material-ui/icons/Settings';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import DashboardIcon from '@material-ui/icons/Dashboard';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import UpdateIcon from '@material-ui/icons/Update';
import Toolbar from '@material-ui/core/Toolbar';
import {AppBar, Typography, Link, Button} from '@material-ui/core';
import Hidden from '@material-ui/core/Hidden';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

import PioreactorIcon from './PioreactorIcon';


const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
  },
  menuButton: {
    marginRight: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  },
  drawerPaper: {
    width: drawerWidth,
  },
  appBar: {
      zIndex: theme.zIndex.drawer + 1,
  },
  title: {
    flexGrow: 1,
  },
  appBarRoot: {
    flexGrow: 1,
  },
  hiddenIconContainer: {
      "&:hover $hiddenIcon": {
          color: 'rgba(0, 0, 0, 0.54)',
      }
  },
  hiddenIcon: {
      color: 'rgba(0, 0, 0, 0)',
      fontSize: "18px",
  },
}));



export default function SideNavAndHeader() {
  const classes = useStyles();

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  function isSelected(path) {
    return (window.location.pathname === path)
  }

  const list = () => (
    <div className={classes.drawerContainer}>
      <List>

        <ListItem href="/overview" component="a" button key={"overview"} selected={isSelected("/") || isSelected("/overview")}>
          <ListItemIcon><DashboardIcon color={(isSelected("/") || isSelected("/overview")) ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/") || isSelected("/overview") ? "primary" : "inherit"}} primary={"Overview"} />
        </ListItem>

        <ListItem button href="/pioreactors"  component="a" key={"pioreactors"} selected={isSelected("/pioreactors")}>
          <ListItemIcon> <PioreactorIcon color={isSelected("/pioreactors") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/pioreactors") ? "primary" : "inherit"}} primary={"Pioreactors"} />
        </ListItem>


      </List>
      <Divider />
      <List>

        <ListItem button href="/config"  component="a" key={"config"} selected={isSelected("/config")}>
          <ListItemIcon> <SettingsIcon color={isSelected("/config") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/config") ? "primary" : "inherit"}} primary={"Configuration"} />
        </ListItem>

        <ListItem href="/export-data" component="a" button key={"export_data"} selected={isSelected("/export-data")}>
          <ListItemIcon><SaveAltIcon color={isSelected("/export-data") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/export-data") ? "primary" : "inherit"}} primary={"Export data"} />
        </ListItem>

      </List>
      <Divider />
      <List>
        <ListItem href="/updates" component="a" button key="updates" selected={isSelected("/updates")}>
          <ListItemIcon><UpdateIcon color={isSelected("/updates") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/updates") ? "primary" : "inherit"}} primary={"Updates"} />
        </ListItem>
        <div className={classes.hiddenIconContainer}>
          <ListItem target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/documentation" component="a" button key="help">
            <ListItemIcon><HelpOutlineIcon/> </ListItemIcon>
            <ListItemText primary={"Help"}/>
            <ListItemSecondaryAction>
                <OpenInNewIcon className={classes.hiddenIcon}/>
            </ListItemSecondaryAction>
          </ListItem>
        </div>
      </List>
    </div>
  );

  return (
      <React.Fragment>

        <div className={classes.appBarRoot}>
          <AppBar position="fixed" className={classes.appBar}>
            <Toolbar variant="dense">

              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                className={classes.menuButton}
              >
                <MenuIcon />
              </IconButton>

              <Typography variant="h6" className={classes.title}>
                <Link color="inherit" underline="none" href="/" className={classes.title}> <img alt="pioreactor logo" src="white_colour.png" style={{width: "120px", height: "29px"}}/> </Link>
              </Typography>
              <Link color="inherit" underline="none" href="https://pioreactor.com/pages/documentation" target="_blank" rel="noopener noreferrer">
                <Button color="inherit" style={{textTransform: "none"}}>Help <HelpOutlineIcon style={{ fontSize: 18, verticalAlign: "middle", marginLeft: 5 }}/></Button>
              </Link>
            </Toolbar>
          </AppBar>
        </div>
        <Hidden smUp implementation="css">
          <Drawer
            variant="temporary"
            anchor="left"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            classes={{
              paper: classes.drawerPaper,
            }}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
          >
            {list()}
          </Drawer>
        </Hidden>
        <Hidden xsDown implementation="css">
          <Drawer
            classes={{
              paper: classes.drawerPaper,
            }}
            variant="permanent"
            open
            className={classes.drawer}
          >
            <Toolbar />
            {list()}
          </Drawer>
        </Hidden>
      </React.Fragment>
  );
}
