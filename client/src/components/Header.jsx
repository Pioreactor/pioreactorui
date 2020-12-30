import React from 'react'
import {AppBar, Toolbar, Typography, Link, Button} from '@material-ui/core';
import {makeStyles} from '@material-ui/styles';
import SideDrawer from './Drawer'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  title: {
    flexGrow: 1,
  },
}));


const Header = () => {
    const classes = useStyles();
    return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar variant="dense">
          <SideDrawer />
          <Typography variant="h6" className={classes.title}>
            <Link color="inherit" underline="none" href="/" className={classes.title}> <img alt="pioreactor logo" src="white_colour.png" style={{width: "120px", height: "29px"}}/> </Link>
          </Typography>
          <Link color="inherit" underline="none" href="https://github.com/Pioreactor/pioreactor/wiki" target="_blank" rel="noopener">
            <Button color="inherit" style={{textTransform: "none"}}>Help <HelpOutlineIcon style={{ fontSize: 18, verticalAlign: "middle", marginLeft: 5 }}/></Button>
          </Link>
        </Toolbar>
      </AppBar>
    </div>
    )
}

export default Header;
