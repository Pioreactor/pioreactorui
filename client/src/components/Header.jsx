import React from 'react'
import {AppBar, Toolbar, Typography, Link} from '@material-ui/core';
import {makeStyles} from '@material-ui/styles';
import Drawer from './Drawer'

const useStyles = makeStyles(() => ({
    logo: {
    },
}));


const Header = () => {
    const classes = useStyles();
    return (
    <AppBar position="static">
        <Toolbar variant="dense">
          <Drawer />
          <Typography className={classes.logo}>
            <Link color="inherit" underline="none" href="/dashboard"> Morbidostat </Link>
          </Typography>
        </Toolbar>
      </AppBar>
    )
}

export default Header;
