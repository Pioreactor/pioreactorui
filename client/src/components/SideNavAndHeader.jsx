import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Badge from '@material-ui/core/Badge';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import MenuIcon from '@material-ui/icons/Menu';
import IconButton from '@material-ui/core/IconButton';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import UpdateIcon from '@material-ui/icons/Update';
import Toolbar from '@material-ui/core/Toolbar';
import {AppBar, Typography, Link, Button} from '@material-ui/core';
import Hidden from '@material-ui/core/Hidden';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import PioreactorIcon from './PioreactorIcon';
import LibraryAddOutlinedIcon from '@material-ui/icons/LibraryAddOutlined';
import DashboardOutlinedIcon from '@material-ui/icons/DashboardOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import InsertChartOutlinedIcon from '@material-ui/icons/InsertChartOutlined';

const drawerWidth = 212;

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
  listItemIcon: {
    minWidth: "40px"
  },
  divider: {
    marginTop: "15px",
    marginBottom: "15px",
  }
}));



export default function SideNavAndHeader() {
  const classes = useStyles();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [version, setVersion] = React.useState(null)
  const [latestVersion, setLatestVersion] = React.useState(null)

  React.useEffect(() => {
    async function getCurrentApp() {
         await fetch("/get_app_version")
        .then((response) => {
          return response.text();
        })
        .then((data) => {
          setVersion(data)
        });
      }

    async function getLatestVersion() {
         await fetch("https://api.github.com/repos/pioreactor/pioreactor/releases/latest")
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          setLatestVersion(data['name'])
        });
      }

      getCurrentApp()
      getLatestVersion()
  }, [])


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
          <ListItemIcon className={classes.listItemIcon}><DashboardOutlinedIcon color={(isSelected("/") || isSelected("/overview")) ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/") || isSelected("/overview") ? "primary" : "inherit"}} primary={"Overview"} />
        </ListItem>

        <ListItem button href="/pioreactors"  component="a" key={"pioreactors"} selected={isSelected("/pioreactors")}>
          <ListItemIcon className={classes.listItemIcon}> <PioreactorIcon color={isSelected("/pioreactors") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/pioreactors") ? "primary" : "inherit"}} primary={"Pioreactors"} />
        </ListItem>


        <ListItem href="/export-data" component="a" button key={"export_data"} selected={isSelected("/export-data")}>
          <ListItemIcon className={classes.listItemIcon}><SaveAltIcon color={isSelected("/export-data") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/export-data") ? "primary" : "inherit"}} primary={"Export data"} />
        </ListItem>

        <ListItem button href="/config"  component="a" key={"config"} selected={isSelected("/config")}>
          <ListItemIcon className={classes.listItemIcon}> <SettingsOutlinedIcon color={isSelected("/config") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/config") ? "primary" : "inherit"}} primary={"Configuration"} />
        </ListItem>

        <ListItem button href="/analysis"  component="a" key={"analysis"} selected={isSelected("/analysis")}>
          <ListItemIcon className={classes.listItemIcon}> <InsertChartOutlinedIcon color={isSelected("/analysis") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/analysis") ? "primary" : "inherit"}} primary={"Analysis"} />
        </ListItem>

        <Divider className={classes.divider} />

        <ListItem href="/plugins" component="a" button key={"plugins"} selected={isSelected("/plugins-data")}>
          <ListItemIcon className={classes.listItemIcon}><LibraryAddOutlinedIcon color={isSelected("/plugins") ? "primary" : "inherit"}/> </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/plugins") ? "primary" : "inherit"}} primary={"Plugins"} />
        </ListItem>

        <ListItem href="/updates" component="a" button key="updates" selected={isSelected("/updates")}>
          <ListItemIcon className={classes.listItemIcon}>
            <Badge variant="dot" color="secondary" invisible={!((version) && (version !== latestVersion))}>
              <UpdateIcon color={isSelected("/updates") ? "primary" : "inherit"}/>
            </Badge>
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{color: isSelected("/updates") ? "primary" : "inherit"}} primary={"Updates"}/>
        </ListItem>

        <div className={classes.hiddenIconContainer}>
          <ListItem target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/documentation" component="a" button key="help">
            <ListItemIcon className={classes.listItemIcon}><HelpOutlineIcon/> </ListItemIcon>
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
